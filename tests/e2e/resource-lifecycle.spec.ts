import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("alex@homi.local");
  await page.getByLabel("Password").fill("HomiDemo!2026");
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("resources can be created, edited, enriched, and archived", async ({
  page,
}) => {
  await signIn(page);
  const suffix = crypto.randomUUID().slice(0, 8);

  const homeResponse = await page.request.post("/api/homes", {
    data: {
      name: `Lifecycle Home ${suffix}`,
      type: "HOUSE",
      addressLine: "10 Garden Lane",
      city: "Basel",
      postalCode: "4000",
      country: "Switzerland",
      constructionYear: 2018,
      timezone: "Europe/Zurich",
    },
  });
  expect(homeResponse.status()).toBe(201);
  const home = (await homeResponse.json()) as { home: { id: string } };
  const homeId = home.home.id;

  const homeUpdate = await page.request.patch(`/api/homes/${homeId}`, {
    data: { name: `Updated Home ${suffix}`, constructionYear: 2019 },
  });
  expect(homeUpdate.status()).toBe(200);
  expect(
    ((await homeUpdate.json()) as { home: { constructionYear: number } }).home
      .constructionYear,
  ).toBe(2019);

  const roomResponse = await page.request.post("/api/rooms", {
    data: {
      homeId,
      name: `Utility ${suffix}`,
      floor: "Ground",
      icon: "Tools",
    },
  });
  expect(roomResponse.status()).toBe(201);
  const roomId = ((await roomResponse.json()) as { room: { id: string } }).room
    .id;

  const roomUpdate = await page.request.patch(`/api/rooms/${roomId}`, {
    data: { name: `Workshop ${suffix}`, floor: "Basement" },
  });
  expect(roomUpdate.status()).toBe(200);

  const assetResponse = await page.request.post("/api/assets", {
    data: {
      homeId,
      roomId,
      name: `Heat pump ${suffix}`,
      category: "Heating",
      brand: "Homi",
      model: "HP-2026",
      serialNumber: `SN-${suffix}`,
      description: "Primary home heating system",
      purchaseDate: "2026-01-10",
      purchasePrice: "4200.00",
      currency: "CHF",
      retailer: "Home Systems AG",
      installationDate: "2026-01-20",
      warrantyStartDate: "2026-01-20",
      warrantyEndDate: "2028-01-20",
      expectedLifetimeYears: 15,
      status: "ACTIVE",
    },
  });
  expect(assetResponse.status()).toBe(201);
  const assetId = ((await assetResponse.json()) as { asset: { id: string } })
    .asset.id;

  const assetUpdate = await page.request.patch(`/api/assets/${assetId}`, {
    data: {
      retailer: "Updated Retailer AG",
      purchasePrice: "4100.00",
      expectedLifetimeYears: 18,
      status: "NEEDS_ATTENTION",
    },
  });
  expect(assetUpdate.status()).toBe(200);
  const updatedAsset = (await assetUpdate.json()) as {
    asset: {
      retailer: string;
      purchasePrice: string;
      expectedLifetimeYears: number;
    };
  };
  expect(updatedAsset.asset.retailer).toBe("Updated Retailer AG");
  expect(updatedAsset.asset.purchasePrice).toBe("4100.00");
  expect(updatedAsset.asset.expectedLifetimeYears).toBe(18);

  const taskResponse = await page.request.post("/api/tasks", {
    data: {
      homeId,
      assetId,
      title: `Annual inspection ${suffix}`,
      description: "Inspect filters and pressure",
      frequencyType: "YEARLY",
      frequencyInterval: 1,
      nextDueAt: "2027-01-20",
      priority: "HIGH",
      estimatedDurationMinutes: 90,
    },
  });
  expect(taskResponse.status()).toBe(201);
  const taskId = ((await taskResponse.json()) as { task: { id: string } }).task
    .id;

  const taskUpdate = await page.request.patch(`/api/tasks/${taskId}`, {
    data: { priority: "CRITICAL", estimatedDurationMinutes: 120 },
  });
  expect(taskUpdate.status()).toBe(200);

  const repairResponse = await page.request.post("/api/repairs", {
    data: {
      homeId,
      assetId,
      title: `Pressure warning ${suffix}`,
      description: "Pressure dropped below normal range",
      issueDate: "2026-07-20",
      repairDate: "2026-07-22",
      status: "COMPLETED",
      provider: "Heating Care GmbH",
      cost: "245.50",
      currency: "CHF",
      warrantyClaim: true,
    },
  });
  expect(repairResponse.status()).toBe(201);
  const repairId = ((await repairResponse.json()) as { repair: { id: string } })
    .repair.id;

  const repairUpdate = await page.request.patch(`/api/repairs/${repairId}`, {
    data: { provider: "Updated Heating Care GmbH", cost: "225.00" },
  });
  expect(repairUpdate.status()).toBe(200);

  const uploadResponse = await page.request.post("/api/uploads", {
    multipart: {
      homeId,
      assetId,
      type: "WARRANTY",
      title: `Heat pump warranty ${suffix}`,
      description: "Extended warranty certificate",
      documentDate: "2026-01-20",
      expiryDate: "2028-01-20",
      tags: "Heating, Warranty",
      file: {
        name: `warranty-${suffix}.pdf`,
        mimeType: "application/pdf",
        buffer: Buffer.from(
          "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF",
        ),
      },
    },
  });
  expect(uploadResponse.status()).toBe(201);
  const documentId = (
    (await uploadResponse.json()) as { document: { id: string } }
  ).document.id;

  const documentUpdate = await page.request.patch(
    `/api/documents/${documentId}`,
    {
      data: {
        title: `Extended warranty ${suffix}`,
        documentDate: "2026-01-21",
        expiryDate: "2029-01-21",
      },
    },
  );
  expect(documentUpdate.status()).toBe(200);

  const documentsBeforeArchive = await page.request.get(
    `/api/documents?homeId=${homeId}`,
  );
  expect(documentsBeforeArchive.status()).toBe(200);
  const documentRows = (await documentsBeforeArchive.json()) as {
    documents: Array<{ id: string; documentDate: string; expiryDate: string }>;
  };
  expect(
    documentRows.documents.find((document) => document.id === documentId),
  ).toMatchObject({
    documentDate: "2026-01-21",
    expiryDate: "2029-01-21",
  });

  expect((await page.request.delete(`/api/tasks/${taskId}`)).status()).toBe(200);
  expect((await page.request.delete(`/api/repairs/${repairId}`)).status()).toBe(
    200,
  );
  expect(
    (await page.request.delete(`/api/documents/${documentId}`)).status(),
  ).toBe(200);
  expect((await page.request.delete(`/api/assets/${assetId}`)).status()).toBe(
    200,
  );
  expect((await page.request.delete(`/api/rooms/${roomId}`)).status()).toBe(200);

  const [tasks, repairs, documents, assets, rooms] = await Promise.all([
    page.request.get(`/api/tasks?homeId=${homeId}`),
    page.request.get(`/api/repairs?homeId=${homeId}`),
    page.request.get(`/api/documents?homeId=${homeId}`),
    page.request.get(`/api/assets?homeId=${homeId}`),
    page.request.get(`/api/rooms?homeId=${homeId}`),
  ]);
  expect(
    ((await tasks.json()) as { tasks: Array<{ id: string }> }).tasks.some(
      (item) => item.id === taskId,
    ),
  ).toBe(false);
  expect(
    ((await repairs.json()) as { repairs: Array<{ id: string }> }).repairs.some(
      (item) => item.id === repairId,
    ),
  ).toBe(false);
  expect(
    (
      (await documents.json()) as { documents: Array<{ id: string }> }
    ).documents.some((item) => item.id === documentId),
  ).toBe(false);
  expect(
    ((await assets.json()) as { assets: Array<{ id: string }> }).assets.some(
      (item) => item.id === assetId,
    ),
  ).toBe(false);
  expect(
    ((await rooms.json()) as { rooms: Array<{ id: string }> }).rooms.some(
      (item) => item.id === roomId,
    ),
  ).toBe(false);

  expect((await page.request.delete(`/api/homes/${homeId}`)).status()).toBe(200);
  const homesResponse = await page.request.get("/api/homes");
  const homesPayload = (await homesResponse.json()) as {
    homes: Array<{ id: string }>;
  };
  expect(homesPayload.homes.some((item) => item.id === homeId)).toBe(false);
});

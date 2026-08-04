import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("alex@homi.local");
  await page.getByLabel("Password").fill("HomiDemo!2026");
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("rejects cross-home resource associations", async ({ page }) => {
  await signIn(page);
  const suffix = crypto.randomUUID().slice(0, 8);

  const firstHomeResponse = await page.request.post("/api/homes", {
    data: { name: `Boundary A ${suffix}`, type: "HOUSE", timezone: "UTC" },
  });
  const secondHomeResponse = await page.request.post("/api/homes", {
    data: { name: `Boundary B ${suffix}`, type: "HOUSE", timezone: "UTC" },
  });
  expect(firstHomeResponse.status()).toBe(201);
  expect(secondHomeResponse.status()).toBe(201);
  const firstHomeId = ((await firstHomeResponse.json()) as { home: { id: string } }).home.id;
  const secondHomeId = ((await secondHomeResponse.json()) as { home: { id: string } }).home.id;

  const roomResponse = await page.request.post("/api/rooms", {
    data: { homeId: firstHomeId, name: `Room ${suffix}` },
  });
  expect(roomResponse.status()).toBe(201);
  const roomId = ((await roomResponse.json()) as { room: { id: string } }).room.id;

  const crossHomeAsset = await page.request.post("/api/assets", {
    data: {
      homeId: secondHomeId,
      roomId,
      name: `Invalid asset ${suffix}`,
      category: "Other",
      status: "ACTIVE",
    },
  });
  expect(crossHomeAsset.status()).toBe(404);

  const assetResponse = await page.request.post("/api/assets", {
    data: {
      homeId: firstHomeId,
      roomId,
      name: `Valid asset ${suffix}`,
      category: "Other",
      status: "ACTIVE",
    },
  });
  expect(assetResponse.status()).toBe(201);
  const assetId = ((await assetResponse.json()) as { asset: { id: string } }).asset.id;

  const crossHomeTask = await page.request.post("/api/tasks", {
    data: {
      homeId: secondHomeId,
      assetId,
      title: `Invalid task ${suffix}`,
      frequencyType: "ONCE",
      frequencyInterval: 1,
      nextDueAt: new Date().toISOString(),
      priority: "MEDIUM",
    },
  });
  expect(crossHomeTask.status()).toBe(404);

  const crossHomeRepair = await page.request.post("/api/repairs", {
    data: {
      homeId: secondHomeId,
      assetId,
      title: `Invalid repair ${suffix}`,
      issueDate: new Date().toISOString().slice(0, 10),
      status: "OPEN",
      warrantyClaim: false,
    },
  });
  expect(crossHomeRepair.status()).toBe(404);

  const crossHomeDocument = await page.request.post("/api/uploads", {
    multipart: {
      homeId: secondHomeId,
      assetId,
      type: "MANUAL",
      title: `Invalid document ${suffix}`,
      file: {
        name: "boundary.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n%%EOF"),
      },
    },
  });
  expect(crossHomeDocument.status()).toBe(404);
});

test("global home switcher persists and drives the dashboard", async ({ page }) => {
  await signIn(page);
  const suffix = crypto.randomUUID().slice(0, 8);
  const homeName = `Selected Home ${suffix}`;
  const response = await page.request.post("/api/homes", {
    data: { name: homeName, type: "HOUSE", city: "Basel", timezone: "Europe/Zurich" },
  });
  expect(response.status()).toBe(201);
  const homeId = ((await response.json()) as { home: { id: string } }).home.id;

  const selection = await page.request.post("/api/homes/selected", {
    data: { homeId },
  });
  expect(selection.status()).toBe(200);

  await page.goto("/dashboard");
  await expect(page.getByText(`${homeName} is ready for the day.`)).toBeVisible();
  await expect(page.getByLabel("Global selected home")).toHaveValue(homeId);

  const homes = (await (await page.request.get("/api/homes")).json()) as {
    homes: Array<{ id: string }>;
    selectedHomeId: string;
  };
  expect(homes.selectedHomeId).toBe(homeId);
  expect(homes.homes[0]?.id).toBe(homeId);
});

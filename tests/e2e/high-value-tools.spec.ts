import { expect, test } from "@playwright/test";

test("high value household tools share one tenant-safe workflow", async ({
  page,
}) => {
  const homesResponse = await page.request.get("/api/homes");
  expect(homesResponse.status()).toBe(200);
  const homesPayload = (await homesResponse.json()) as {
    homes: Array<{ id: string; name: string }>;
  };
  const home = homesPayload.homes[0]!;
  const suffix = crypto.randomUUID().slice(0, 8);

  const assetResponse = await page.request.post("/api/assets", {
    data: {
      homeId: home.id,
      name: `Rainwater pump ${suffix}`,
      category: "Garden",
      brand: "Homi Test",
      status: "ACTIVE",
    },
  });
  expect(assetResponse.status()).toBe(201);
  const assetId = ((await assetResponse.json()) as { asset: { id: string } })
    .asset.id;

  const templateTitle = `Inspect pump filter ${suffix}`;
  const templateResponse = await page.request.post(
    "/api/maintenance-templates",
    {
      data: {
        homeId: home.id,
        title: templateTitle,
        description: "Inspect and rinse the inlet filter.",
        category: "Garden",
        frequencyType: "MONTHLY",
        frequencyInterval: 1,
        priority: "MEDIUM",
        estimatedDurationMinutes: 25,
      },
    },
  );
  expect(templateResponse.status()).toBe(201);
  const templateId = (
    (await templateResponse.json()) as { template: { id: string } }
  ).template.id;

  const appliedResponse = await page.request.post(
    `/api/maintenance-templates/${templateId}/apply`,
    {
      data: {
        homeId: home.id,
        assetId,
        nextDueAt: new Date(Date.now() - 86_400_000).toISOString(),
      },
    },
  );
  expect(appliedResponse.status()).toBe(201);
  const taskId = ((await appliedResponse.json()) as { task: { id: string } })
    .task.id;

  const completionResponse = await page.request.post(
    `/api/tasks/${taskId}/complete`,
    {
      data: {
        idempotencyKey: crypto.randomUUID(),
        completedAt: new Date().toISOString(),
        notes: "Filter cleaned and pump tested.",
        cost: "42.50",
        currency: "CHF",
        serviceProvider: "Homi Garden Care",
      },
    },
  );
  expect(completionResponse.status()).toBe(200);

  const repairTitle = `Replace pump seal ${suffix}`;
  const repairResponse = await page.request.post("/api/repairs", {
    data: {
      homeId: home.id,
      assetId,
      title: repairTitle,
      issueDate: new Date().toISOString().slice(0, 10),
      repairDate: new Date().toISOString().slice(0, 10),
      status: "COMPLETED",
      provider: "Homi Garden Care",
      cost: "120.00",
      currency: "CHF",
      warrantyClaim: false,
    },
  });
  expect(repairResponse.status()).toBe(201);

  const searchResponse = await page.request.get(
    `/api/search?homeId=${home.id}&q=${encodeURIComponent(suffix)}`,
  );
  expect(searchResponse.status()).toBe(200);
  const searchPayload = (await searchResponse.json()) as {
    results: Array<{ title: string }>;
  };
  expect(
    searchPayload.results.some((result) => result.title.includes(suffix)),
  ).toBe(true);

  const calendarResponse = await page.request.get(
    `/api/calendar?homeId=${home.id}&start=${new Date(
      Date.now() - 7 * 86_400_000,
    ).toISOString()}&end=${new Date(Date.now() + 40 * 86_400_000).toISOString()}`,
  );
  expect(calendarResponse.status()).toBe(200);
  const calendarPayload = (await calendarResponse.json()) as {
    events: Array<{ title: string }>;
  };
  expect(
    calendarPayload.events.some((event) => event.title === templateTitle),
  ).toBe(true);
  expect(
    calendarPayload.events.some((event) => event.title === repairTitle),
  ).toBe(true);

  const qrResponse = await page.request.get(`/api/assets/${assetId}/qr`);
  expect(qrResponse.status()).toBe(200);
  expect(qrResponse.headers()["content-type"]).toContain("image/svg+xml");
  expect(await qrResponse.text()).toContain('viewBox="0 0 45 45"');

  await page.goto(`/assets/${assetId}`);
  await expect(
    page.getByRole("heading", { name: `Rainwater pump ${suffix}` }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "QR & NFC shortcut" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: `QR code that opens Rainwater pump ${suffix}`,
    }),
  ).toBeVisible();

  const searchTrigger = page.getByRole("button", { name: "Search Homi" });
  await expect(searchTrigger).toBeVisible();
  await expect(searchTrigger.getByText("⌘ K")).toBeVisible();
  await searchTrigger.click();
  const searchInput = page.getByLabel(
    "Search homes, assets, tasks and documents",
  );
  await expect(searchInput).toBeVisible();
  await searchInput.fill(suffix);
  await expect(
    page.getByRole("option", {
      name: new RegExp(`Rainwater pump ${suffix}`),
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/maintenance/templates");
  await expect(
    page.getByRole("heading", { name: "Maintenance library" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: templateTitle })).toBeVisible();

  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(page.getByText(templateTitle).first()).toBeVisible();

  await page.goto("/costs");
  await expect(
    page.getByRole("heading", { name: "Cost insights" }),
  ).toBeVisible();
  await expect(page.getByText("CHF").first()).toBeVisible();
  await expect(page.getByText(templateTitle)).toBeVisible();
  await expect(page.getByText(repairTitle)).toBeVisible();
});

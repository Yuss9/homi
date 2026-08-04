import { expect, test } from "@playwright/test";

test("dashboard shows live counts and calculated home health", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("alex@homi.local");
  await page.getByLabel("Password").fill("HomiDemo!2026");
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const suffix = crypto.randomUUID().slice(0, 8);
  const homeName = `Dashboard Home ${suffix}`;
  const homeResponse = await page.request.post("/api/homes", {
    data: {
      name: homeName,
      type: "HOUSE",
      timezone: "Europe/Paris",
    },
  });
  expect(homeResponse.status()).toBe(201);
  const homeId = ((await homeResponse.json()) as { home: { id: string } }).home.id;

  const selectedResponse = await page.request.post("/api/homes/selected", {
    data: { homeId },
  });
  expect(selectedResponse.status()).toBe(200);

  const assetResponse = await page.request.post("/api/assets", {
    data: {
      homeId,
      name: `Boiler ${suffix}`,
      category: "Heating",
      status: "NEEDS_ATTENTION",
    },
  });
  expect(assetResponse.status()).toBe(201);
  const assetId = ((await assetResponse.json()) as { asset: { id: string } }).asset.id;

  const taskResponse = await page.request.post("/api/tasks", {
    data: {
      homeId,
      assetId,
      title: `Urgent boiler check ${suffix}`,
      frequencyType: "ONCE",
      frequencyInterval: 1,
      nextDueAt: new Date(Date.now() - 86_400_000).toISOString(),
      priority: "CRITICAL",
    },
  });
  expect(taskResponse.status()).toBe(201);

  const repairResponse = await page.request.post("/api/repairs", {
    data: {
      homeId,
      assetId,
      title: `Boiler leak ${suffix}`,
      issueDate: new Date().toISOString().slice(0, 10),
      status: "OPEN",
      warrantyClaim: false,
    },
  });
  expect(repairResponse.status()).toBe(201);

  const uploadResponse = await page.request.post("/api/uploads", {
    multipart: {
      homeId,
      assetId,
      type: "MANUAL",
      title: `Boiler manual ${suffix}`,
      file: {
        name: `boiler-${suffix}.pdf`,
        mimeType: "application/pdf",
        buffer: Buffer.from(
          "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF",
        ),
      },
    },
  });
  expect(uploadResponse.status()).toBe(201);

  await page.goto("/dashboard");

  await expect(page.getByText(`${homeName} is ready for the day.`)).toBeVisible();
  await expect(page.getByText(/Home health · Critical · \d+\/100/)).toBeVisible();
  await expect(page.getByText(`Urgent boiler check ${suffix}`)).toBeVisible();
  await expect(page.getByText("overdue · critical priority")).toBeVisible();

  const assetMetric = page.locator(".summary-cell").filter({ hasText: "Assets" });
  const taskMetric = page.locator(".summary-cell").filter({ hasText: "Tasks" });
  const documentMetric = page
    .locator(".summary-cell")
    .filter({ hasText: "Documents" });

  await expect(assetMetric.locator("strong")).toHaveText("1");
  await expect(taskMetric.locator("strong")).toHaveText("1");
  await expect(documentMetric.locator("strong")).toHaveText("1");
});

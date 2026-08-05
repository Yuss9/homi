import { expect, test } from "@playwright/test";

const pexelsPlaceholder = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <rect width="1200" height="800" fill="#e8f0e9" />
    <circle cx="890" cy="180" r="180" fill="#e8f0f8" />
    <path d="M0 650 C250 500 420 760 680 570 C890 420 1040 590 1200 470 V800 H0Z" fill="#d8e4da" />
  </svg>
`;

test.beforeEach(async ({ page }) => {
  await page.route("https://images.pexels.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: pexelsPlaceholder,
    });
  });
});

async function selectedHomeId(page: import("@playwright/test").Page) {
  const homesResponse = await page.request.get("/api/homes");
  expect(homesResponse.status()).toBe(200);
  const payload = (await homesResponse.json()) as {
    homes: Array<{ id: string }>;
  };
  const homeId = payload.homes[0]?.id;
  expect(homeId).toBeTruthy();

  const selectionResponse = await page.request.post("/api/homes/selected", {
    data: { homeId },
  });
  expect(selectionResponse.status()).toBe(200);
  return homeId!;
}

test("landing exposes the editorial palette, Pexels credit and safe headers", async ({
  page,
}) => {
  const landingResponse = await page.goto("/");
  expect(landingResponse?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: /Care for your home,\s*effortlessly/i }),
  ).toBeVisible();
  await expect(page.getByText("Photography · Pexels")).toBeVisible();
  await expect(page.locator("img[src*='images.pexels.com']").first()).toBeVisible();

  const headers = landingResponse?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain(
    "https://images.pexels.com",
  );
  expect(headers["permissions-policy"]).toContain("camera=(self)");
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--homi-sage")
          .trim(),
      ),
    )
    .toBe("#607e69");
});

test("authenticated dashboard and Operations use the new editorial context", async ({
  page,
}) => {
  await selectedHomeId(page);

  await page.goto("/dashboard");
  const dashboardAtmosphere = page.locator(".dashboard-atmosphere");
  await expect(dashboardAtmosphere).toBeVisible();
  await expect(
    dashboardAtmosphere.locator("img[src*='images.pexels.com']"),
  ).toHaveAttribute("alt", /home|kitchen|care/i);

  await page.goto("/operations");
  await expect(
    page.getByRole("heading", { name: "One place, four simple jobs." }),
  ).toBeVisible();
  await expect(
    page.locator(".operations-guide-photo img[src*='images.pexels.com']"),
  ).toHaveAttribute("alt", /home care|kitchen counter/i);
  await expect(page.getByRole("tab", { name: /Maintenance/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Insurance/ })).toBeVisible();
});

test("maintenance, scanner and template surfaces remain contained", async ({
  page,
}) => {
  const homeId = await selectedHomeId(page);
  const suffix = crypto.randomUUID().slice(0, 8);
  const title = `Future UI check ${suffix}`;
  const taskResponse = await page.request.post("/api/tasks", {
    data: {
      homeId,
      title,
      frequencyType: "ONCE",
      frequencyInterval: 1,
      nextDueAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      priority: "LOW",
    },
  });
  expect(taskResponse.status()).toBe(201);

  await page.goto("/maintenance");
  const task = page.locator(".dash-task", { hasText: title });
  await expect(task).toBeVisible();
  const notDue = task.locator(".task-not-due");
  await expect(notDue).toBeVisible();
  const [taskBox, statusBox] = await Promise.all([
    task.boundingBox(),
    notDue.boundingBox(),
  ]);
  expect(taskBox).not.toBeNull();
  expect(statusBox).not.toBeNull();
  expect(statusBox!.x).toBeGreaterThanOrEqual(taskBox!.x);
  expect(statusBox!.x + statusBox!.width).toBeLessThanOrEqual(
    taskBox!.x + taskBox!.width + 1,
  );
  expect(statusBox!.y).toBeGreaterThanOrEqual(taskBox!.y);
  expect(statusBox!.y + statusBox!.height).toBeLessThanOrEqual(
    taskBox!.y + taskBox!.height + 1,
  );

  await page.goto("/scan");
  await expect(page.getByRole("button", { name: "Start camera" })).toBeVisible();
  const capture = page.getByLabel("Capture an equipment label");
  await expect(capture).toHaveAttribute("accept", "image/*");
  await expect(capture).toHaveAttribute("capture", "environment");

  await page.goto("/maintenance/templates");
  const useTemplate = page.getByRole("button", { name: "Use template" }).first();
  await expect(useTemplate).toBeVisible();
  await useTemplate.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("Choose where this routine belongs and when Homi should surface"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

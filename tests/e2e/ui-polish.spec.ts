import { expect, test } from "@playwright/test";

test("polished product surfaces keep actions inside their cards", async ({
  page,
}) => {
  const homesResponse = await page.request.get("/api/homes");
  expect(homesResponse.status()).toBe(200);
  const homes = (await homesResponse.json()) as {
    homes: Array<{ id: string }>;
  };
  const homeId = homes.homes[0]!.id;
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

  await page.goto("/operations");
  await expect(
    page.getByRole("heading", { name: "One place, four simple jobs." }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Maintenance/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Insurance/ })).toBeVisible();

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

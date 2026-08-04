import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test as setup } from "@playwright/test";

const authState = "playwright/.auth/user.json";

setup("authenticate seeded household user", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("alex@homi.local");
  await page.getByLabel("Password").fill("HomiDemo!2026");
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Alex/,
    }),
  ).toBeVisible({ timeout: 15_000 });
  await mkdir(dirname(authState), { recursive: true });
  await page.context().storageState({ path: authState });
});

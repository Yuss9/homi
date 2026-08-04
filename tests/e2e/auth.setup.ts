import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test as setup } from "@playwright/test";

const authState = "playwright/.auth/user.json";

setup("authenticate seeded household user", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("alex@homi.local");
  await page.getByLabel("Password").fill("HomiDemo!2026");
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await mkdir(dirname(authState), { recursive: true });
  await page.context().storageState({ path: authState });
});

import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("landing page is accessible and responsive", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your home, remembered." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start your journal/i })).toBeVisible();
  const marketingHeader = page.locator("header");
  if (!isMobile) {
    await expect(
      marketingHeader.getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
  }
  await expect(
    marketingHeader.getByRole("link", { name: "Create account" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
test("anonymous users cannot open the private dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
});
test("auth forms expose labels and invalid states", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "10");
});

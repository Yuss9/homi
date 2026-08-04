import { expect, test } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZJ84AAAAASUVORK5CYII=",
  "base64",
);

test("a user can update their household identity and invite several people", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  const suffix = crypto.randomUUID().slice(0, 8);
  const nickname = `Alex Household ${suffix}`;

  await page.goto("/settings");
  await page.getByLabel("Nickname").fill(nickname);
  await page.getByRole("button", { name: "Save nickname" }).click();
  await expect(page.getByText("Your nickname was updated.")).toBeVisible();
  await expect(page.locator(".app-user").getByText(nickname)).toBeVisible();

  await page.getByLabel("Choose a profile photo").setInputFiles({
    name: `avatar-${suffix}.png`,
    mimeType: "image/png",
    buffer: onePixelPng,
  });
  await page.getByRole("button", { name: "Update photo" }).click();
  await expect(page.getByText("Your profile photo was updated.")).toBeVisible();
  await expect(page.locator(".app-user .user-avatar.has-image")).toBeVisible();

  await page.goto("/members");
  const firstEmail = `household-${suffix}-one@example.com`;
  const secondEmail = `household-${suffix}-two@example.com`;
  await page
    .getByLabel("Email addresses")
    .fill(`${firstEmail}\n${secondEmail}`);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByText("2 invitations sent.")).toBeVisible();
  await expect(page.getByText(firstEmail)).toBeVisible();
  await expect(page.getByText(secondEmail)).toBeVisible();

  for (const email of [firstEmail, secondEmail]) {
    const invitation = page.locator(".pending-invitation").filter({
      hasText: email,
    });
    await invitation.getByRole("button", { name: "Revoke" }).click();
    await expect(invitation).toHaveCount(0);
  }

  await page.goto("/settings");
  await page.getByRole("button", { name: "Remove custom photo" }).click();
  await expect(
    page.getByText("Your custom profile photo was removed."),
  ).toBeVisible();
  await page.getByLabel("Nickname").fill("Alex Morgan");
  await page.getByRole("button", { name: "Save nickname" }).click();
  await expect(page.getByText("Your nickname was updated.")).toBeVisible();
});

import { mkdir } from "node:fs/promises";
import { chromium, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outputDir = "artifacts/pr31-screenshots";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function settle(page, delay = 1200) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await Promise.all(
      Array.from(document.images).map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
              setTimeout(resolve, 4000);
            }),
      ),
    );
  });
  await page.waitForTimeout(delay);
}

async function capture(page, path, fullPage = true) {
  await settle(page);
  await page.screenshot({
    path: `${outputDir}/${path}`,
    fullPage,
    animations: "disabled",
  });
}

try {
  const publicContext = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const publicPage = await publicContext.newPage();
  await publicPage.goto(`${baseURL}/`);
  await capture(publicPage, "01-landing-desktop.png");
  await publicContext.close();

  const mobilePublicContext = await browser.newContext({
    ...devices["iPhone 13"],
    reducedMotion: "reduce",
  });
  const mobilePublicPage = await mobilePublicContext.newPage();
  await mobilePublicPage.goto(`${baseURL}/`);
  await capture(mobilePublicPage, "02-landing-mobile.png");
  await mobilePublicContext.close();

  const appContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await appContext.newPage();
  await page.goto(`${baseURL}/sign-in`);
  await page.getByLabel("Email address").fill("alex@homi.local");
  await page.getByLabel("Password").fill("HomiDemo!2026");
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await page.waitForURL(/\/dashboard$/);

  await page.goto(`${baseURL}/maintenance`);
  await capture(page, "03-maintenance.png");

  await page.goto(`${baseURL}/operations`);
  await capture(page, "04-operations.png");

  await page.goto(`${baseURL}/maintenance/templates`);
  await settle(page, 500);
  await page.getByRole("button", { name: /Use template/i }).first().click();
  await capture(page, "05-template-scheduler.png", false);

  await page.goto(`${baseURL}/scan`);
  await capture(page, "06-scanner.png");

  await page.goto(`${baseURL}/settings`);
  await settle(page, 700);
  const profilePhotoHeading = page.getByRole("heading", { name: "Profile photo" });
  const profileForm = profilePhotoHeading.locator("xpath=ancestor::form[1]");
  await profileForm.scrollIntoViewIfNeeded();
  await profileForm.screenshot({
    path: `${outputDir}/07-profile-avatar.png`,
    animations: "disabled",
  });

  const authState = await appContext.storageState();
  const mobileAppContext = await browser.newContext({
    ...devices["iPhone 13"],
    storageState: authState,
    reducedMotion: "reduce",
  });
  const mobileAppPage = await mobileAppContext.newPage();
  await mobileAppPage.goto(`${baseURL}/maintenance`);
  await capture(mobileAppPage, "08-maintenance-mobile.png");
  await mobileAppContext.close();
  await appContext.close();
} finally {
  await browser.close();
}

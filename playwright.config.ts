import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: "npm run dev", url: "http://localhost:3000", env: { NODE_ENV: "test" }, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});

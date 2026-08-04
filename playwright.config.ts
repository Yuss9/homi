import { defineConfig, devices } from "@playwright/test";

const authState = "playwright/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // Stateful journeys share a seeded user and database, so CI runs one test at
  // a time. Authentication itself is performed once by the setup project to
  // avoid exercising the production rate limiter for every scenario and retry.
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "desktop",
      dependencies: ["setup"],
      testIgnore: /.*\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: authState },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      testIgnore: /.*\.setup\.ts/,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        storageState: authState,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        env: { NODE_ENV: "test" },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

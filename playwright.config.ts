import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: {
      FEEDFIX_E2E: "true",
      GA_MEASUREMENT_ID: "",
      CLARITY_PROJECT_ID: "",
      APP_URL: "http://127.0.0.1:3100",
      PAYMENT_MODE: "mock",
      UNKNOWN_ERROR_STORE_DIR: "/tmp/feedfix-playwright-errors",
      NOTIFICATION_STORE_DIR: "/tmp/feedfix-playwright-notifications",
      CORPUS_STORE_DIR: "/tmp/feedfix-playwright-study",
      TEMP_STORE_DIR: "/tmp/feedfix-playwright",
      USAGE_LOG_PATH: "/tmp/feedfix-playwright-metrics/usage.json",
      ALLOW_SYNTHETIC_FIXTURES: "true",
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});

import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 180000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:5178",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15000,
  },
  webServer: {
    command:
      "npm run dev -- --mode production --host 127.0.0.1 --port 5178 --strictPort",
    url: "http://localhost:5178",
    reuseExistingServer: false,
    timeout: 120000,
  },
});

import "dotenv/config";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3101);
const baseURL = `http://127.0.0.1:${PORT}`;
const dataDir = path.join(os.tmpdir(), "careeros-e2e");

if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error("Set TEST_DATABASE_URL to a separate database; end-to-end tests delete its data");
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["iPhone 13"], browserName: "chromium" }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    // Requires a prior `pnpm build` (the test:e2e script does this).
    command: `pnpm exec next start --hostname 127.0.0.1 --port ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      CAREEROS_DATA_DIR: dataDir,
      NODE_ENV: "production",
    },
  },
});

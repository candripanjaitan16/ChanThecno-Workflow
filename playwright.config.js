import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    launchOptions: process.env.PW_CHROMIUM
      ? { executablePath: process.env.PW_CHROMIUM }
      : {},
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    env: {
      AUTH_SECRET: "browser-test-auth-secret-12345678901234567890",
      ADMIN_PASSWORD: "browser-test-password",
      ENCRYPTION_KEY: "ab".repeat(32),
    },
    timeout: 30000,
  },
});

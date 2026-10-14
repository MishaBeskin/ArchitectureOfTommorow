import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // e2e runs against a production build, not the dev server
  webServer: {
    command: `pnpm build && pnpm exec next start -p ${PORT}`,
    url: baseURL,
    // Canonical URLs, the sitemap and structured data are absolute, so they need the test origin.
    env: {
      NEXT_PUBLIC_SITE_URL: baseURL,
      // Cloudflare's documented dummy keys: the widget always passes, so tests can submit the form.
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      // Every test run comes from one address, so the real limit would lock repeated runs out.
      CONTACT_RATE_LIMIT_MAX: "10000",
      // Never email anyone from tests, whatever is in .env.local.
      RESEND_API_KEY: "",
      CONTACT_TO_EMAIL: "",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

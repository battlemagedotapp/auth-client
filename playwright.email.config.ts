import { defineConfig } from "@playwright/test";

const baseURL = process.env.AUTH_CLIENT_EMAIL_BASE_URL;
if (!baseURL) throw new Error("Set AUTH_CLIENT_EMAIL_BASE_URL for live-email qualification");
if (!process.env.AUTH_CLIENT_EMAIL_DEPLOYMENT) {
  throw new Error("Set AUTH_CLIENT_EMAIL_DEPLOYMENT for live-email qualification");
}

export default defineConfig({
  testDir: "./e2e-live",
  // Provider deliveries span sequential account and invitation phases; each has
  // its own three-minute bound in the tests. This aggregate limit is live-email only.
  timeout: 15 * 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL, headless: true, actionTimeout: 10_000 },
  workers: 1,
});

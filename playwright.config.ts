import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  use: { baseURL: "http://localhost:8099", headless: true },
  workers: 1,
});

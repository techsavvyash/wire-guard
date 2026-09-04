import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "pnpm --filter next-basic exec next dev --port 3100",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: "http://localhost:3100"
    },
    {
      command: "pnpm --filter react-vite-basic exec vite --port 3200",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: "http://localhost:3200"
    }
  ],
  projects: [
    {
      name: "next-chromium",
      testMatch: "next-*.spec.ts",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "react-vite-chromium",
      testMatch: "react-*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3200"
      }
    }
  ]
})

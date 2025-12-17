import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // increase to allow dev server build + generate steps to finish
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 30_000,
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npm --prefix "./" run dev',
    url: process.env.PLAYWRIGHT_BASE_URL || process.env.E2E_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 300_000,
  },
  globalSetup: require.resolve('./test/global-setup.js'),
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

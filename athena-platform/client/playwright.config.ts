import { defineConfig, devices } from '@playwright/test';

const playwrightPort = Number(process.env.PLAYWRIGHT_PORT || '3000');
const playwrightBaseUrl = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${playwrightPort}`;
const reuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_SERVER === 'true'
    ? true
    : process.env.PLAYWRIGHT_REUSE_SERVER === 'false'
    ? false
    : !process.env.CI;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: playwrightBaseUrl,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: process.env.CI
      ? `npm run start -- -p ${playwrightPort}`
      : `npm run dev -- -p ${playwrightPort}`,
    url: playwrightBaseUrl,
    reuseExistingServer,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

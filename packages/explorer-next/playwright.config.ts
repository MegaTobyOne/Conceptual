import { defineConfig, devices } from '@playwright/test';

const port = process.env.PSPF_E2E_PORT ?? '4173';
const host = `http://127.0.0.1:${port}`;
const rawBasePath = process.env.PSPF_BASE ?? '/';
const basePath = rawBasePath.endsWith('/') ? rawBasePath : `${rawBasePath}/`;
const baseURL = new URL(basePath, host).toString();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `PSPF_BASE=${basePath} pnpm run build && PSPF_BASE=${basePath} pnpm run preview`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

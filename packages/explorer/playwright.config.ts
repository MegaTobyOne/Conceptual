import { defineConfig, devices } from '@playwright/test';

const port = process.env.PSPF_E2E_PORT ?? '4173';
const host = `http://127.0.0.1:${port}`;
const envBase = process.env.PSPF_BASE;
const rawBasePath = envBase ?? '/';
const basePath = rawBasePath.endsWith('/') ? rawBasePath : `${rawBasePath}/`;
const baseURL = new URL(basePath, host).toString();
// Only forward PSPF_BASE when explicitly set; the default build uses a
// relative base ('./') that works at any mount path, and release gates rely
// on dist keeping that portable base.
const envPrefix = envBase ? `PSPF_BASE=${basePath} ` : '';

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
    command: `${envPrefix}pnpm run build && ${envPrefix}pnpm run preview`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

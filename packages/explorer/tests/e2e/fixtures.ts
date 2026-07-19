import { expect, test as base, type Page, type Request, type Response } from '@playwright/test';

function isDeploymentResource(request: Request): boolean {
  const resourceType = request.resourceType();
  return resourceType === 'script' || resourceType === 'stylesheet' || resourceType === 'worker';
}

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const browserFailures: string[] = [];

    page.on('pageerror', (error) => {
      browserFailures.push(`pageerror: ${error.message}`);
    });

    page.on('console', (message) => {
      if (message.type() === 'error') {
        browserFailures.push(`console error: ${message.text()}`);
      }
    });

    page.on('requestfailed', (request) => {
      const errorText = request.failure()?.errorText ?? '';
      if (errorText === 'net::ERR_ABORTED') return;

      if (isDeploymentResource(request)) {
        browserFailures.push(`request failed: ${request.method()} ${request.url()} ${errorText}`);
      }
    });

    page.on('response', (response: Response) => {
      const request = response.request();
      if (response.status() >= 400 && isDeploymentResource(request)) {
        browserFailures.push(
          `bad response: ${response.status()} ${request.method()} ${response.url()}`,
        );
      }
    });

    await use(page);

    expect(browserFailures).toEqual([]);
  },
});

export { expect };

/**
 * UX evidence pack (S0, ADR 0087).
 *
 * Captures every key route at empty, typical, and volume data states in both
 * themes, and records interaction-step counts for two flagship operator
 * journeys. Output lands in .tmp/ux-evidence/v<version>/ at the repo root;
 * scripts/ux-evidence-pack.mjs merges the chunks and asserts the pack shape.
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const explorerPackage = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as {
  version: string;
};
const packRoot = resolve(process.cwd(), '../../.tmp/ux-evidence', `v${explorerPackage.version}`);
const screensDir = join(packRoot, 'screens');
const chunksDir = join(packRoot, 'chunks');

const ROUTES = [
  { slug: 'home', hash: '#/', component: 'pspf-home-view' },
  { slug: 'requirements', hash: '#/requirements', component: 'pspf-requirements-view' },
  {
    slug: 'requirement-gov-001',
    hash: '#/requirement/GOV-001',
    component: 'pspf-requirement-view',
  },
  { slug: 'posture', hash: '#/posture', component: 'pspf-posture-view' },
  { slug: 'analytics', hash: '#/analytics', component: 'pspf-analytics-view' },
  { slug: 'risks', hash: '#/risks', component: 'pspf-risks-view' },
  { slug: 'actions', hash: '#/actions', component: 'pspf-actions-view' },
  { slug: 'map', hash: '#/map', component: 'pspf-relationship-map-view' },
] as const;

const STATES = ['empty', 'typical', 'volume'] as const;
const THEMES = ['dark', 'light'] as const;

type DataState = (typeof STATES)[number];

function writeChunk(name: string, value: unknown): void {
  mkdirSync(chunksDir, { recursive: true });
  writeFileSync(join(chunksDir, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function resetApp(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();
  await expect(page.locator('pspf-app')).toBeVisible();
}

async function applyTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((preference) => localStorage.setItem('pspf-theme', preference), theme);
  await page.reload();
  await expect(page.locator('pspf-app')).toHaveAttribute('data-theme', theme);
}

async function seed(page: Page, state: DataState): Promise<void> {
  if (state === 'empty') return;
  const volume = state === 'volume';
  await page.evaluate(async (isVolume) => {
    const request = indexedDB.open('pspf-explorer.v3');
    const db = await new Promise<IDBDatabase>((resolveDb, rejectDb) => {
      request.onerror = () => rejectDb(request.error ?? new Error('Failed to open PSPF database'));
      request.onsuccess = () => resolveDb(request.result);
    });
    const now = new Date('2026-08-01T00:00:00.000Z').toISOString();
    const tx = db.transaction(
      ['compliance', 'risks', 'actions', 'directions', 'workTracking'],
      'readwrite',
    );
    const riskCount = isVolume ? 400 : 2;
    const actionCount = isVolume ? 400 : 2;
    tx.objectStore('compliance').put({
      requirementId: 'GOV-001',
      state: 'no',
      evidence: [{ kind: 'note', value: 'Gap accepted for uplift plan', addedAt: now }],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('compliance').put({
      requirementId: 'GOV-002',
      state: 'yes',
      evidence: [{ kind: 'note', value: 'Policy approved and published', addedAt: now }],
      createdAt: now,
      updatedAt: now,
    });
    for (let i = 0; i < riskCount; i += 1) {
      tx.objectStore('risks').put({
        id: `risk-evidence-${i}`,
        title: `Evidence pack risk ${i + 1}: control gap remains untreated`,
        likelihood: (i % 5) + 1,
        impact: ((i + 2) % 5) + 1,
        status: i % 7 === 0 ? 'closed' : 'open',
        requirementIds: ['GOV-001'],
        actionIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    for (let i = 0; i < actionCount; i += 1) {
      tx.objectStore('actions').put({
        id: `action-evidence-${i}`,
        title: `Evidence pack action ${i + 1}: implement uplift step`,
        type: 'remediation',
        status: i % 3 === 0 ? 'blocked' : 'in-progress',
        dueAt: '2026-09-30',
        requirementIds: ['GOV-001'],
        riskIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    tx.objectStore('directions').put({
      id: 'direction-evidence-1',
      reference: 'PSPF Direction 001-2026',
      title: 'Report treatment progress quarterly',
      issuedAt: '2026-05-01',
      requirementIds: ['GOV-001'],
      responseState: 'not-set',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('workTracking').put({
      id: 'work-evidence-1',
      requirementId: 'GOV-001',
      note: 'Started remediation planning',
      effort: '2h',
      createdAt: now,
      updatedAt: now,
    });
    await new Promise<void>((resolveTx, rejectTx) => {
      tx.oncomplete = () => resolveTx();
      tx.onerror = () => rejectTx(tx.error ?? new Error('Failed to seed evidence data'));
      tx.onabort = () => rejectTx(tx.error ?? new Error('Evidence data transaction aborted'));
    });
    db.close();
  }, volume);
  await page.reload();
}

for (const state of STATES) {
  for (const theme of THEMES) {
    test(`evidence pack captures ${state} state in ${theme} theme`, async ({ page }) => {
      test.setTimeout(120_000);
      await resetApp(page);
      await seed(page, state);
      await applyTheme(page, theme);
      mkdirSync(screensDir, { recursive: true });
      const captured: string[] = [];
      for (const route of ROUTES) {
        await page.goto(`./${route.hash}`);
        await expect(page.locator(route.component)).toBeVisible();
        const fileName = `${state}--${theme}--${route.slug}.png`;
        await page.screenshot({ path: join(screensDir, fileName), fullPage: true });
        captured.push(fileName);
      }
      expect(captured).toHaveLength(ROUTES.length);
      writeChunk(`screens-${state}-${theme}`, { state, theme, screenshots: captured });
    });
  }
}

test('journey: record a direction and confirm it on the relationship map', async ({ page }) => {
  await resetApp(page);
  const steps: string[] = [];
  const step = (description: string) => steps.push(description);

  step('Open Directions from primary navigation');
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Directions$/ })
    .click();
  const dirs = page.locator('pspf-directions-view');
  step('Enter direction reference');
  await dirs.getByLabel('Reference').fill('PSPF Direction 042-2026');
  step('Enter direction title');
  await dirs.getByLabel('Title').fill('Confirm evidence pack journey');
  step('Enter issued date');
  await dirs.getByLabel('Issued').fill('2026-08-01');
  step('Link the direction to GOV-001');
  await dirs.getByLabel(/Linked requirement IDs/i).fill('GOV-001');
  step('Save the direction');
  await dirs.getByRole('button', { name: 'Add direction' }).click();
  step('Open the relationship map to confirm the link');
  await page.locator('pspf-app').getByRole('link', { name: /^Map$/ }).click();
  await expect(page.locator('pspf-relationship-map-view').getByTestId('counts')).toContainText(
    '2 nodes',
  );

  writeChunk('journey-record-direction', {
    id: 'record-direction-and-verify',
    title: 'Record a direction and confirm it on the relationship map',
    steps: steps.length,
    stepList: steps,
  });
  expect(steps.length).toBeGreaterThan(0);
});

test('journey: answer "what changed in the last 30 days"', async ({ page }) => {
  await resetApp(page);
  const steps: string[] = [];
  const step = (description: string) => steps.push(description);

  step('Open Analytics from primary navigation');
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Analytics$/ })
    .click();
  const analytics = page.locator('pspf-analytics-view');
  await expect(analytics.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  step('Select the 30-day change window');
  await analytics.getByRole('button', { name: '30 days' }).click();
  await expect(analytics.locator('.temporal-note').first()).toContainText(/compliance change/);

  writeChunk('journey-what-changed', {
    id: 'what-changed-30-days',
    title: 'Answer "what changed in the last 30 days"',
    steps: steps.length,
    stepList: steps,
  });
  expect(steps.length).toBeGreaterThan(0);
});

import { test, expect } from './fixtures';

test('relationship map renders nodes from a direction linked to a requirement', async ({
  page,
}) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  // Empty state first
  await page.locator('pspf-app').getByRole('link', { name: /^Map$/ }).click();
  await expect(page.locator('pspf-relationship-map-view [data-testid="empty"]')).toBeVisible();

  // Seed a direction linked to GOV-001
  await page
    .locator('pspf-app')
    .getByRole('link', { name: /^Directions$/ })
    .click();
  const dirs = page.locator('pspf-directions-view');
  await dirs.getByLabel('Reference').fill('PSPF Direction 099-2025');
  await dirs.getByLabel('Title').fill('Map test direction');
  await dirs.getByLabel('Issued').fill('2025-04-01');
  await dirs.getByLabel(/Linked requirement IDs/i).fill('GOV-001');
  await dirs.getByRole('button', { name: 'Add direction' }).click();

  // Visit the map
  await page.locator('pspf-app').getByRole('link', { name: /^Map$/ }).click();
  const view = page.locator('pspf-relationship-map-view');
  await expect(view.getByTestId('counts')).toContainText('2 nodes');
  await expect(view.getByTestId('counts')).toContainText('1 edges');
  await expect(view.locator('[data-testid="adjacency"] tr')).toHaveCount(1);
  await expect(view.locator('[data-testid="adjacency"]')).toContainText('GOV-001');
});

test('relationship map shows work connected to compliance gaps', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          (window as Window & { __copiedMapSummary?: string }).__copiedMapSummary = text;
          return Promise.resolve();
        },
      },
      configurable: true,
    });
  });
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page.evaluate(async () => {
    const request = indexedDB.open('pspf-explorer.v3');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error ?? new Error('Failed to open PSPF database'));
      request.onsuccess = () => resolve(request.result);
    });
    const now = new Date('2026-05-07T00:00:00.000Z').toISOString();
    const tx = db.transaction(
      ['compliance', 'workTracking', 'risks', 'actions', 'directions'],
      'readwrite',
    );
    tx.objectStore('compliance').put({
      requirementId: 'GOV-001',
      state: 'no',
      evidence: [{ kind: 'note', value: 'Gap accepted for uplift plan', addedAt: now }],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('compliance').put({
      requirementId: 'GOV-002',
      state: 'no',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('workTracking').put({
      id: 'work-map-1',
      requirementId: 'GOV-001',
      note: 'Started remediation planning',
      effort: '2h',
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('risks').put({
      id: 'risk-map-1',
      title: 'Control gap remains untreated',
      likelihood: 4,
      impact: 4,
      status: 'open',
      requirementIds: ['GOV-001'],
      actionIds: ['action-map-1'],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('actions').put({
      id: 'action-map-1',
      title: 'Implement uplift plan',
      type: 'remediation',
      status: 'blocked',
      dueAt: '2026-01-01',
      requirementIds: ['GOV-001'],
      riskIds: ['risk-map-1'],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('directions').put({
      id: 'direction-map-1',
      reference: 'PSPF Direction 123-2026',
      title: 'Report treatment progress',
      issuedAt: '2026-05-01',
      requirementIds: ['GOV-001'],
      responseState: 'not-set',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to seed map test data'));
      tx.onabort = () => reject(tx.error ?? new Error('Map test data transaction aborted'));
    });
    db.close();
  });
  await page.reload();

  await page.locator('pspf-app').getByRole('link', { name: /^Map$/ }).click();
  const view = page.locator('pspf-relationship-map-view');
  await expect(view.getByTestId('counts')).toContainText('5 nodes');
  await expect(view.getByText('Gaps with work')).toBeVisible();
  await expect(view.locator('.metric').filter({ hasText: 'Gaps with work' })).toContainText('1');
  await expect(view.locator('.metric').filter({ hasText: 'Gaps without work' })).toContainText('1');
  await expect(
    view.locator('.metric').filter({ hasText: 'Blocked/overdue actions' }),
  ).toContainText('1');
  await expect(
    view.locator('.metric').filter({ hasText: 'Directions needing response' }),
  ).toContainText('1');

  await expect(view.getByTestId('map-inspector')).toContainText('GOV-001');
  await expect(view.getByTestId('map-inspector')).toContainText('Not yet implemented');
  await expect(view.getByTestId('map-inspector')).toContainText('1 open / 1 total');
  await expect(view.getByTestId('map-inspector')).toContainText('1 active / 1 total');
  await expect(view.getByTestId('map-inspector')).toContainText('1 entries');
  await expect(view.getByTestId('map-inspector')).toContainText('1 items');

  const adjacency = view.locator('[data-testid="adjacency"]');
  await expect(adjacency).toContainText('Risk affects requirement');
  await expect(adjacency).toContainText('Action remediates requirement');
  await expect(adjacency).toContainText('Action treats risk');
  await expect(adjacency).toContainText('Direction modifies requirement');

  await expect(view.getByTestId('map-legend')).toContainText('Risk affects requirement');
  await expect(view.getByTestId('map-legend')).toContainText('Direction modifies requirement');

  await view.getByTestId('copy-map-summary').click();
  await expect(view.getByRole('status')).toContainText('Copied map summary.');
  const copied = await page.evaluate(
    () => (window as Window & { __copiedMapSummary?: string }).__copiedMapSummary,
  );
  expect(copied).toContain('Relationship map summary');
  expect(copied).toContain('GOV-001:');
  expect(copied).toContain('Control gap remains untreated');
  expect(copied).toContain('Action compliance value');
  expect(copied).toContain('Implement uplift plan');
  expect(copied).toContain('Risk treatment progress');
  expect(copied).toContain('Direction impact');
  expect(copied).toContain('PSPF Direction 123-2026');

  await view.getByTestId('unlinked-gaps-only').check();
  await expect(view.getByTestId('counts')).toContainText('1 nodes');
  await expect(view.getByTestId('counts')).toContainText('0 edges');
  await expect(view.getByTestId('map-inspector')).toContainText('GOV-002');
});

test('relationship map inspector reveals the value chain of an action', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page.evaluate(async () => {
    const request = indexedDB.open('pspf-explorer.v3');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error ?? new Error('Failed to open PSPF database'));
      request.onsuccess = () => resolve(request.result);
    });
    const now = new Date('2026-05-07T00:00:00.000Z').toISOString();
    const tx = db.transaction(['compliance', 'risks', 'actions'], 'readwrite');
    tx.objectStore('compliance').put({
      requirementId: 'GOV-001',
      state: 'no',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('compliance').put({
      requirementId: 'GOV-002',
      state: 'risk-managed',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('risks').put({
      id: 'risk-value-1',
      title: 'Privileged access drift',
      likelihood: 4,
      impact: 5,
      status: 'open',
      requirementIds: ['GOV-001'],
      actionIds: ['action-value-1'],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('actions').put({
      id: 'action-value-1',
      title: 'Tighten access controls',
      type: 'remediation',
      status: 'in-progress',
      requirementIds: ['GOV-001', 'GOV-002'],
      riskIds: ['risk-value-1'],
      createdAt: now,
      updatedAt: now,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to seed map test data'));
      tx.onabort = () => reject(tx.error ?? new Error('Map test data transaction aborted'));
    });
    db.close();
  });
  await page.reload();

  await page.locator('pspf-app').getByRole('link', { name: /^Map$/ }).click();
  const view = page.locator('pspf-relationship-map-view');
  await expect(view.getByTestId('counts')).toContainText('4 nodes');

  // Force the inspector to show the action node, since clicking the
  // Cytoscape canvas in headless mode is unreliable.
  await expect(view.getByTestId('map-canvas')).toBeVisible();
  await page.evaluate(async () => {
    function findInShadow(root: Document | ShadowRoot, tag: string): Element | null {
      const direct = root.querySelector(tag);
      if (direct) return direct;
      const all = root.querySelectorAll('*');
      for (const node of all) {
        const sr = (node as HTMLElement).shadowRoot;
        if (sr) {
          const found = findInShadow(sr, tag);
          if (found) return found;
        }
      }
      return null;
    }
    const found = findInShadow(document, 'pspf-relationship-map-view');
    if (!found) throw new Error('Map view missing');
    const el = found as Element & {
      selectedNodeId?: string;
      updateComplete?: Promise<unknown>;
    };
    el.selectedNodeId = 'action-value-1';
    await el.updateComplete;
  });

  const inspector = view.getByTestId('map-inspector');
  await expect(inspector).toContainText('Tighten access controls');
  const actionValue = view.getByTestId('action-value');
  await expect(actionValue).toContainText('Requirements addressed');
  await expect(actionValue).toContainText('2 (2 currently a gap)');
  await expect(actionValue).toContainText('Uniquely covered');
  await expect(actionValue).toContainText('2 requirements would be uncovered');
  await expect(actionValue).toContainText('Risks treated');
  await expect(actionValue).toContainText('1 (1 open, 1 high or extreme)');

  const reqs = view.getByTestId('connected-requirements');
  await expect(reqs).toContainText('GOV-001');
  await expect(reqs).toContainText('GOV-002');
  await expect(reqs).toContainText('Not yet implemented');
  await expect(reqs).toContainText('Risk-managed');

  const risks = view.getByTestId('connected-risks');
  await expect(risks).toContainText('Privileged access drift');
  await expect(risks).toContainText('extreme');
  await expect(risks).toContainText('open');
});

test('relationship map filters narrow the visible network', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page.evaluate(async () => {
    const request = indexedDB.open('pspf-explorer.v3');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error ?? new Error('Failed to open PSPF database'));
      request.onsuccess = () => resolve(request.result);
    });
    const now = new Date('2026-05-07T00:00:00.000Z').toISOString();
    const tx = db.transaction(['compliance', 'risks', 'actions'], 'readwrite');
    tx.objectStore('compliance').put({
      requirementId: 'GOV-001',
      state: 'no',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('compliance').put({
      requirementId: 'GOV-002',
      state: 'risk-managed',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('risks').put({
      id: 'risk-extreme',
      title: 'Extreme exposure',
      likelihood: 5,
      impact: 5,
      status: 'open',
      requirementIds: ['GOV-001'],
      actionIds: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('risks').put({
      id: 'risk-low',
      title: 'Low exposure',
      likelihood: 1,
      impact: 1,
      status: 'open',
      requirementIds: ['GOV-002'],
      actionIds: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('actions').put({
      id: 'action-blocked',
      title: 'Blocked uplift',
      type: 'remediation',
      status: 'blocked',
      requirementIds: ['GOV-001'],
      riskIds: ['risk-extreme'],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('actions').put({
      id: 'action-progress',
      title: 'In progress review',
      type: 'review',
      status: 'in-progress',
      requirementIds: ['GOV-002'],
      riskIds: ['risk-low'],
      createdAt: now,
      updatedAt: now,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to seed map test data'));
      tx.onabort = () => reject(tx.error ?? new Error('Map test data transaction aborted'));
    });
    db.close();
  });
  await page.reload();

  await page.locator('pspf-app').getByRole('link', { name: /^Map$/ }).click();
  const view = page.locator('pspf-relationship-map-view');
  // Two requirements + two risks + two actions = 6 nodes initially.
  await expect(view.getByTestId('counts')).toContainText('6 nodes');

  // Open the filter panel.
  await view.getByTestId('toggle-filters').click();
  await expect(view.getByTestId('map-filters')).toBeVisible();

  // Filter to extreme risks only.
  await view.getByTestId('filter-risk-band').getByRole('checkbox', { name: 'Extreme' }).check();
  await expect(view.getByTestId('counts')).toContainText('5 nodes');
  // The button label reflects active filter count.
  await expect(view.getByTestId('toggle-filters')).toContainText('(1)');

  // Add an action filter for "Blocked or overdue only".
  await view.getByTestId('filter-action-overdue').check();
  await expect(view.getByTestId('counts')).toContainText('4 nodes');
  await expect(view.getByTestId('toggle-filters')).toContainText('(2)');

  // Clear filters returns to the original view.
  await view.getByTestId('filter-clear').click();
  await expect(view.getByTestId('counts')).toContainText('6 nodes');
  await expect(view.getByTestId('toggle-filters')).not.toContainText('(');
});

test('relationship map supports layout switch, node search and URL focus', async ({ page }) => {
  // Seed a small graph (1 requirement, 1 risk, 1 action) so search can find nodes.
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();
  await page.evaluate(async () => {
    const request = indexedDB.open('pspf-explorer.v3');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error ?? new Error('Failed to open PSPF database'));
      request.onsuccess = () => resolve(request.result);
    });
    const now = new Date('2026-05-07T00:00:00.000Z').toISOString();
    const tx = db.transaction(['compliance', 'risks', 'actions'], 'readwrite');
    tx.objectStore('compliance').put({
      requirementId: 'GOV-001',
      state: 'no',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('risks').put({
      id: 'risk-search-target',
      title: 'Searchable supply-chain risk',
      likelihood: 4,
      impact: 4,
      status: 'open',
      requirementIds: ['GOV-001'],
      actionIds: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('actions').put({
      id: 'action-search-1',
      title: 'Vendor uplift programme',
      type: 'remediation',
      status: 'in-progress',
      requirementIds: ['GOV-001'],
      riskIds: ['risk-search-target'],
      createdAt: now,
      updatedAt: now,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to seed'));
      tx.onabort = () => reject(tx.error ?? new Error('Aborted'));
    });
    db.close();
  });
  await page.reload();

  await page.locator('pspf-app').getByRole('link', { name: /^Map$/ }).click();
  const view = page.locator('pspf-relationship-map-view');

  // Layout selector may have persisted value from previous tests, verify current value
  const layout = view.getByTestId('map-layout');
  await expect(layout).toBeVisible();
  await expect(layout).toBeEnabled();
  const currentLayout = await layout.inputValue();
  expect(currentLayout).toMatch(/^(lanes|cose|breadthfirst|concentric|grid)$/);

  // Switch to breadthfirst and verify
  await layout.selectOption('breadthfirst');
  await expect(layout).toHaveValue('breadthfirst', { timeout: 5000 });

  // Search by label finds the action and selecting it via Enter focuses it.
  const search = view.getByTestId('map-search');
  await search.fill('vendor');
  await expect(view.getByTestId('map-search-result-action-search-1')).toBeVisible();
  await search.press('Enter');
  await expect(view.getByTestId('map-inspector')).toContainText('Vendor uplift programme');

  // Clear selection.
  await view.getByTestId('map-clear-selection').click();
  await expect(view.getByTestId('map-clear-selection')).toBeHidden();
});

test('relationship map honours ?focus= query param to deep-link a node', async ({ page }) => {
  // Reuse a single seeded item.
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();
  await page.evaluate(async () => {
    const request = indexedDB.open('pspf-explorer.v3');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error ?? new Error('open failed'));
      request.onsuccess = () => resolve(request.result);
    });
    const now = new Date('2026-05-07T00:00:00.000Z').toISOString();
    const tx = db.transaction(['compliance', 'risks'], 'readwrite');
    tx.objectStore('compliance').put({
      requirementId: 'GOV-010',
      state: 'no',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('risks').put({
      id: 'risk-deep-link',
      title: 'Deep-linked risk',
      likelihood: 3,
      impact: 4,
      status: 'open',
      requirementIds: ['GOV-010'],
      actionIds: [],
      createdAt: now,
      updatedAt: now,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('seed failed'));
      tx.onabort = () => reject(tx.error ?? new Error('seed aborted'));
    });
    db.close();
  });

  // Visit with focus query param.
  await page.goto('./?focus=risk-deep-link#/map');
  const view = page.locator('pspf-relationship-map-view');
  await expect(view.getByTestId('map-inspector')).toContainText('Deep-linked risk');
});

test('relationship map board mode lists items in columns by kind', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page.evaluate(async () => {
    const open = indexedDB.open('pspf-explorer.v3');
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('Failed to open PSPF database'));
    });
    const now = new Date().toISOString();
    const tx = db.transaction(['compliance', 'risks', 'actions', 'directions'], 'readwrite');
    tx.objectStore('compliance').put({
      requirementId: 'GOV-001',
      state: 'no',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('risks').put({
      id: 'risk-board-1',
      title: 'Board risk',
      likelihood: 4,
      impact: 4,
      status: 'open',
      requirementIds: ['GOV-001'],
      actionIds: ['action-board-1'],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('actions').put({
      id: 'action-board-1',
      title: 'Board action',
      status: 'in-progress',
      requirementIds: ['GOV-001'],
      riskIds: ['risk-board-1'],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('directions').put({
      id: 'direction-board-1',
      reference: 'PSPF Direction 042-2025',
      title: 'Board direction',
      issuedAt: '2025-01-01',
      requirementIds: ['GOV-001'],
      responseState: 'not-set',
      createdAt: now,
      updatedAt: now,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('seed failed'));
      tx.onabort = () => reject(tx.error ?? new Error('seed aborted'));
    });
    db.close();
  });

  await page.reload();
  await page.locator('pspf-app').getByRole('link', { name: /^Map$/ }).click();
  const view = page.locator('pspf-relationship-map-view');
  await view.getByTestId('map-mode-board').click();
  await expect(view.getByTestId('map-board')).toBeVisible();
  await expect(view.getByTestId('board-column-requirement')).toContainText('GOV-001');
  await expect(view.getByTestId('board-column-risk')).toContainText('Board risk');
  await expect(view.getByTestId('board-column-action')).toContainText('Board action');
  await expect(view.getByTestId('board-column-direction')).toContainText('PSPF Direction 042-2025');

  await view.getByTestId('board-card-action-board-1').click();
  await expect(view.getByTestId('map-inspector')).toContainText('Board action');

  // Switching back to graph mode reveals the canvas
  await view.getByTestId('map-mode-graph').click();
  await expect(view.getByTestId('map-canvas')).toBeVisible();
});

test('relationship map board mode draws connection lines and supports multi-select highlight', async ({
  page,
}) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases?.();
    for (const d of dbs ?? []) if (d.name) indexedDB.deleteDatabase(d.name);
  });
  await page.reload();

  await page.evaluate(async () => {
    const open = indexedDB.open('pspf-explorer.v3');
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('Failed to open PSPF database'));
    });
    const now = new Date().toISOString();
    const tx = db.transaction(['compliance', 'risks', 'actions', 'directions'], 'readwrite');
    tx.objectStore('compliance').put({
      requirementId: 'GOV-001',
      state: 'no',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('compliance').put({
      requirementId: 'GOV-002',
      state: 'no',
      evidence: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('risks').put({
      id: 'risk-link-1',
      title: 'Linked risk one',
      likelihood: 3,
      impact: 3,
      status: 'open',
      requirementIds: ['GOV-001'],
      actionIds: ['action-link-1'],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('risks').put({
      id: 'risk-link-2',
      title: 'Unrelated risk',
      likelihood: 2,
      impact: 2,
      status: 'open',
      requirementIds: ['GOV-002'],
      actionIds: [],
      createdAt: now,
      updatedAt: now,
    });
    tx.objectStore('actions').put({
      id: 'action-link-1',
      title: 'Linked action',
      status: 'in-progress',
      requirementIds: ['GOV-001'],
      riskIds: ['risk-link-1'],
      createdAt: now,
      updatedAt: now,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('seed failed'));
      tx.onabort = () => reject(tx.error ?? new Error('seed aborted'));
    });
    db.close();
  });

  await page.reload();
  await page.locator('pspf-app').getByRole('link', { name: /^Map$/ }).click();
  const view = page.locator('pspf-relationship-map-view');
  await view.getByTestId('map-mode-board').click();
  const board = view.getByTestId('map-board');
  await expect(board).toBeVisible();

  // Connection lines render as <path> children of the board-edges SVG overlay.
  const edgePaths = board.locator('svg.board-edges path');
  await expect.poll(async () => edgePaths.count()).toBeGreaterThan(0);

  // Single-click GOV-001 — its linked risk and action should keep full opacity,
  // while the unrelated risk should be dimmed.
  await view.getByTestId('board-card-GOV-001').click();
  await expect(view.getByTestId('board-card-risk-link-1')).not.toHaveClass(/dimmed/);
  await expect(view.getByTestId('board-card-action-link-1')).not.toHaveClass(/dimmed/);
  await expect(view.getByTestId('board-card-risk-link-2')).toHaveClass(/dimmed/);

  // Ctrl-click adds the unrelated risk to the focus set; both groups now
  // unfaded and both cards carry the focused class.
  await view.getByTestId('board-card-risk-link-2').click({ modifiers: ['ControlOrMeta'] });
  await expect(view.getByTestId('board-card-GOV-001')).toHaveClass(/focused/);
  await expect(view.getByTestId('board-card-risk-link-2')).toHaveClass(/focused/);
  await expect(view.getByTestId('board-card-risk-link-2')).not.toHaveClass(/dimmed/);

  // Plain-clicking elsewhere clears multi-select.
  await view.getByTestId('board-card-action-link-1').click();
  await expect(view.getByTestId('board-card-GOV-001')).not.toHaveClass(/focused/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { chromium, type Page } from "playwright";
import type {
  ActionEntity,
  DirectionEntity,
  DomainEntity,
  LinkEntity,
  RequirementEntity,
  RiskEntity
} from "@pspf/contracts";
import {
  buildConnectedViewConnectorPath,
  buildConnectedViewModel,
  CONNECTED_VIEW_BROWSER_SCRIPT,
  CONNECTED_VIEW_STYLES,
  renderConnectedViewBodyHtml
} from "./index.js";

test("buildConnectedViewModel orients supported links into a traceable chain", () => {
  const model = buildConnectedViewModel(sampleInput());

  assert.deepEqual(
    model.edges.map((edge) => `${edge.fromId}->${edge.toId}`),
    ["DIR-1->REQ-GOV", "REQ-GOV->RSK-1", "RSK-1->ACT-1", "REQ-TECH->ACT-1"]
  );
  assert.equal(
    model.groupedLanes.some((lane) => lane.domainCode === "governance"),
    true
  );
  assert.equal(
    model.groupedLanes.some((lane) => lane.domainCode === "technology"),
    true
  );
});

test("renderConnectedViewBodyHtml exposes per-domain controls", () => {
  const html = renderConnectedViewBodyHtml(buildConnectedViewModel(sampleInput()), {
    mode: "workshop",
    defaultLayout: "domains"
  });

  assert.match(html, /data-cv-domain-toggle="governance"/);
  assert.match(html, /data-cv-domain-toggle="technology"/);
  assert.match(html, /data-cv-domain="governance"/);
  assert.match(html, /data-cv-action="toggle-not-applicable"/);
});

test("buildConnectedViewConnectorPath anchors horizontal and wrapped lanes on stable sides", () => {
  const horizontal = buildConnectedViewConnectorPath(
    { left: 10, top: 20, width: 100, height: 40 },
    { left: 260, top: 28, width: 100, height: 40 }
  );
  assert.equal(horizontal.fromSide, "right");
  assert.equal(horizontal.toSide, "left");
  assert.match(horizontal.path, /^M 110 40 C /);

  const wrapped = buildConnectedViewConnectorPath(
    { left: 40, top: 20, width: 160, height: 48 },
    { left: 48, top: 220, width: 160, height: 48 }
  );
  assert.equal(wrapped.fromSide, "bottom");
  assert.equal(wrapped.toSide, "top");
  assert.match(wrapped.path, /^M 120 68 C 120 /);
});

test("browser runtime hides selected domains and redraws connected paths", async () => {
  const model = buildConnectedViewModel(sampleInput());
  const body = renderConnectedViewBodyHtml(model, { mode: "workshop", defaultLayout: "domains" });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.setContent(
      `<!doctype html><html><head><style>${CONNECTED_VIEW_STYLES}</style></head><body>${body}<script>${CONNECTED_VIEW_BROWSER_SCRIPT}</script></body></html>`
    );
    await page.evaluate(() =>
      (globalThis as typeof globalThis & { pspfConnectedView?: { initAll: () => void } }).pspfConnectedView?.initAll()
    );
    await waitForConnectedViewFrames(page);
    assert.equal(await page.locator("[data-cv-links] path").count(), 4);

    const initialPath = await page.locator("[data-cv-links] path").first().getAttribute("d");
    assert.ok(initialPath?.startsWith("M "));

    assert.equal(await topCardIdInLane(page, "lane-risks"), "RSK-0");
    assert.equal(await topCardIdInLane(page, "lane-actions"), "ACT-0");

    await page.locator('[data-cv-card][data-cv-id="REQ-GOV"]').click();
    await waitForConnectedViewFrames(page);
    assert.equal(await topCardIdInLane(page, "lane-risks"), "RSK-1");
    assert.equal(await topCardIdInLane(page, "lane-actions"), "ACT-1");

    await page.locator('[data-cv-action="clear"]').click();
    await waitForConnectedViewFrames(page);
    assert.equal(await topCardIdInLane(page, "lane-risks"), "RSK-0");
    assert.equal(await topCardIdInLane(page, "lane-actions"), "ACT-0");

    await page.locator('[data-cv-domain-toggle="governance"]').click();
    await waitForConnectedViewFrames(page);
    assert.equal(await page.locator("[data-cv-links] path").count(), 1);

    assert.equal(
      await page
        .locator('[data-cv-lane="lane-req-governance"]')
        .evaluate((node) => node.classList.contains("cv-lane-hidden")),
      true
    );
    assert.equal(
      await page
        .locator('[data-cv-card][data-cv-domain="technology"]')
        .evaluate((node) => node.classList.contains("cv-domain-hidden")),
      false
    );
  } finally {
    await browser.close();
  }
});

test("browser runtime can hide not applicable requirements and redraw connected paths", async () => {
  const input = sampleInput();
  const model = buildConnectedViewModel({
    ...input,
    requirements: [
      ...input.requirements,
      {
        id: "REQ-NA",
        entityType: "requirement",
        title: "Not applicable requirement",
        domainId: "DOM-TECH",
        assessmentStatus: "not-applicable"
      } as RequirementEntity
    ],
    links: [...input.links, link("LNK-NA", "REQ-NA", "requirement", "ACT-0", "action", "addressed-by")]
  });
  const body = renderConnectedViewBodyHtml(model, { mode: "workshop", defaultLayout: "domains" });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.setContent(
      `<!doctype html><html><head><style>${CONNECTED_VIEW_STYLES}</style></head><body>${body}<script>${CONNECTED_VIEW_BROWSER_SCRIPT}</script></body></html>`
    );
    await page.evaluate(() =>
      (globalThis as typeof globalThis & { pspfConnectedView?: { initAll: () => void } }).pspfConnectedView?.initAll()
    );
    await waitForConnectedViewFrames(page);
    assert.equal(await page.locator("[data-cv-links] path").count(), 5);

    await page.locator('[data-cv-action="toggle-not-applicable"]').click();
    await waitForConnectedViewFrames(page);
    assert.equal(
      await page
        .locator('[data-cv-card][data-cv-id="REQ-NA"]')
        .evaluate((node) => node.classList.contains("cv-not-applicable-hidden")),
      true
    );
    assert.equal(await page.locator("[data-cv-links] path").count(), 4);
  } finally {
    await browser.close();
  }
});

async function waitForConnectedViewFrames(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))))
  );
}

async function topCardIdInLane(page: Page, laneId: string): Promise<string | undefined> {
  return page.locator(`[data-cv-lane="${laneId}"]`).evaluate((lane) => {
    const visibleCards = Array.from(lane.querySelectorAll<HTMLElement>("[data-cv-card]")).filter(
      (card) => card.offsetParent !== null
    );
    return visibleCards.sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top)[0]
      ?.dataset.cvId;
  });
}

function sampleInput(): Parameters<typeof buildConnectedViewModel>[0] {
  return {
    domains: [
      { id: "DOM-GOV", code: "governance", title: "Governance", sortOrder: 1 } as Pick<
        DomainEntity,
        "id" | "title" | "code" | "sortOrder"
      >,
      { id: "DOM-TECH", code: "technology", title: "Technology", sortOrder: 2 } as Pick<
        DomainEntity,
        "id" | "title" | "code" | "sortOrder"
      >
    ],
    directions: [
      {
        id: "DIR-1",
        entityType: "direction",
        title: "Set assurance priority",
        reference: "DIR-1",
        responseState: "yes"
      } as DirectionEntity
    ],
    requirements: [
      {
        id: "REQ-GOV",
        entityType: "requirement",
        title: "Governance requirement",
        domainId: "DOM-GOV",
        assessmentStatus: "in-progress"
      } as RequirementEntity,
      {
        id: "REQ-TECH",
        entityType: "requirement",
        title: "Technology requirement",
        domainId: "DOM-TECH",
        assessmentStatus: "met"
      } as RequirementEntity
    ],
    risks: [
      {
        id: "RSK-0",
        entityType: "risk",
        title: "Unlinked queue risk",
        likelihood: 2,
        impact: 2,
        status: "open"
      } as RiskEntity,
      {
        id: "RSK-1",
        entityType: "risk",
        title: "High exposure",
        likelihood: 4,
        impact: 4,
        status: "open"
      } as RiskEntity
    ],
    actions: [
      { id: "ACT-0", entityType: "action", title: "Unlinked queue action", status: "todo" } as ActionEntity,
      { id: "ACT-1", entityType: "action", title: "Reduce exposure", status: "todo" } as ActionEntity
    ],
    links: [
      link("LNK-1", "DIR-1", "direction", "REQ-GOV", "requirement", "targets"),
      link("LNK-2", "RSK-1", "risk", "REQ-GOV", "requirement", "exposed-by"),
      link("LNK-3", "ACT-1", "action", "RSK-1", "risk", "treated-by"),
      link("LNK-4", "REQ-TECH", "requirement", "ACT-1", "action", "addressed-by")
    ]
  };
}

function link(
  id: string,
  fromId: string,
  fromType: LinkEntity["fromType"],
  toId: string,
  toType: LinkEntity["toType"],
  linkType: LinkEntity["linkType"]
): LinkEntity {
  return { id, entityType: "link", fromId, fromType, toId, toType, linkType, recordStatus: "active" } as LinkEntity;
}

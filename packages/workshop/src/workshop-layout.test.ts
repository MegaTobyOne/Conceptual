import assert from "node:assert/strict";
import test from "node:test";
import { chromium, type Page } from "playwright";
import { shellHtml } from "./webview/shell.js";

test("Requirement browser controls are not covered by list items", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1180, height: 760 } });
    await page.setContent(shellHtml("Requirement browser layout", requirementBrowserFixture()));

    await assertRequirementBrowserStack(page);
    await assertElementOwnsItsCentre(page, ".requirement-browser__filter");
    await assertElementOwnsItsCentre(page, ".requirement-browser__filters");
    await assertElementOwnsItsCentre(page, "[data-requirement-browser-count]");
  } finally {
    await browser.close();
  }
});

async function assertRequirementBrowserStack(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const rectFor = (selector: string) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing ${selector}`);
      }
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    };
    return {
      input: rectFor(".requirement-browser__filter"),
      filters: rectFor(".requirement-browser__filters"),
      list: rectFor(".requirement-browser__list"),
      count: rectFor(".requirement-browser__count")
    };
  });

  assert.ok(layout.input.height > 0, "search input should be visible");
  assert.ok(layout.filters.height > 0, "status filters should be visible");
  assert.ok(layout.list.height > 80, "Requirement list should keep a scrollable row");
  assert.ok(layout.count.height > 0, "filtered-count cue should be visible");
  assert.ok(layout.input.bottom <= layout.filters.top, "search input must sit above status filters");
  assert.ok(layout.filters.bottom <= layout.list.top, "status filters must sit above Requirement list items");
  assert.ok(layout.list.bottom <= layout.count.top, "Requirement list must sit above filtered-count cue");
}

async function assertElementOwnsItsCentre(page: Page, selector: string): Promise<void> {
  const owner = await page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing ${targetSelector}`);
    }
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const topElement = document.elementFromPoint(x, y);
    return Boolean(topElement && (topElement === element || element.contains(topElement)));
  }, selector);

  assert.equal(owner, true, `${selector} should not be covered by another feature`);
}

function requirementBrowserFixture(): string {
  const items = Array.from(
    { length: 42 },
    (_, index) => `<button type="button" class="requirement-browser__item" role="listitem">
      <span class="requirement-browser__number">Requirement ${index + 1}</span>
      <span class="requirement-browser__meta">Governance · Not assessed</span>
    </button>`
  ).join("");

  return `<div class="requirement-page">
    <nav class="requirement-page__tabs" aria-label="Requirement domain tabs">
      <button type="button" aria-pressed="true">Governance 18</button>
      <button type="button" aria-pressed="false">Information 12</button>
      <button type="button" aria-pressed="false">Directions 6</button>
    </nav>
    <div class="requirement-browser">
      <section class="requirement-browser__nav" aria-label="Requirement browser">
        <h2>Requirements</h2>
        <input class="requirement-browser__filter" type="search" aria-label="Filter requirements" placeholder="Filter by title, domain, or status">
        <div class="requirement-browser__filters" aria-label="Requirement status filters">
          <button type="button" aria-pressed="true">All 42</button>
          <button type="button">Met 10</button>
          <button type="button">Partial 14</button>
          <button type="button">Not met 9</button>
          <button type="button">Not assessed 9</button>
        </div>
        <div class="requirement-browser__list" role="list" aria-label="Scrollable Requirements list">${items}</div>
        <p class="muted requirement-browser__count"><span class="requirement-browser__count-chip" data-requirement-browser-count>42 of 42 Requirements</span><button type="button" class="secondary" hidden>Clear filters</button></p>
      </section>
      <div class="requirement-browser__content"><section><h2>Edit Requirement</h2><p>Representative editor panel.</p></section></div>
    </div>
  </div>`;
}

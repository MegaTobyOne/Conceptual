// Operator-run live verification harness for the Workshop Risk workbench.
// Playwright drives the VS Code workbench page; raw CDP reaches inside webview
// iframes, which Playwright does not attach as child frames.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const ENDPOINT = process.env.PSPF_EDH_CDP ?? "http://127.0.0.1:9333";
const steps = [];
let nextId = 1;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let browser = await chromium.connectOverCDP(ENDPOINT);
let page = browser
  .contexts()[0]
  .pages()
  .find((candidate) => candidate.url().includes("workbench"));
assert.ok(page, "no VS Code workbench page; launch the Extension Development Host first");

// VS Code can replace its renderer target mid-run; reconnect rather than failing.
async function pageOf() {
  if (page && !page.isClosed()) return page;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      browser = await chromium.connectOverCDP(ENDPOINT);
      const candidate = browser
        .contexts()[0]
        .pages()
        .find((entry) => entry.url().includes("workbench"));
      if (candidate && !candidate.isClosed()) {
        page = candidate;
        return page;
      }
    } catch {
      // the window is still coming back up
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("lost the VS Code workbench page");
}

async function attachTarget(filter) {
  const targets = await (await fetch(`${ENDPOINT}/json/list`)).json();
  const target = targets.find(filter);
  if (!target) return undefined;
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
    else entry.resolve(message.result);
  });
  return {
    close: () => socket.close(),
    async evaluate(expression) {
      const id = nextId++;
      const result = await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(
          JSON.stringify({
            id,
            method: "Runtime.evaluate",
            params: { expression, awaitPromise: true, returnByValue: true }
          })
        );
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? "evaluate failed");
      }
      return result.result.value;
    }
  };
}

async function focusWorkbench() {
  const active = await pageOf();
  await active
    .locator(".tabs-container .tab.active, .tabs-container .tab")
    .first()
    .click({ timeout: 5000 })
    .catch(() => {});
  await wait(300);
}

async function runCommand(label) {
  await focusWorkbench();
  const active = await pageOf();
  await active.keyboard.press("Meta+Shift+P");
  await wait(500);
  await active.keyboard.type(label, { delay: 6 });
  await wait(1000);
  await active.keyboard.press("Enter");
  await wait(1400);
}

const notifications = async () => (await pageOf()).locator(".notification-list-item-message").allTextContents();
const tabs = async () => (await pageOf()).locator(".tabs-container .tab").allTextContents();

async function closeAllEditors() {
  await runCommand("View: Close All Editors");
  await wait(900);
}

async function closeOtherEditors() {
  await runCommand("View: Close Other Editors in Group");
  await wait(900);
}

// --- risk workbench webview access -------------------------------------------------

// VS Code swaps the webview's inner iframe on every html update, so always take the
// active one rather than the first, which can briefly be the outgoing document.
const INNER =
  '(document.querySelector(\'iframe[name="active-frame"]\') || document.querySelectorAll("iframe")[document.querySelectorAll("iframe").length - 1] || {}).contentDocument';

async function riskFrame() {
  const targets = await (await fetch(`${ENDPOINT}/json/list`)).json();
  for (const target of targets.filter((entry) => entry.type === "iframe")) {
    const client = await attachTarget((entry) => entry.id === target.id);
    if (!client) continue;
    const isRisk = await client
      .evaluate(`Boolean(${INNER} && ${INNER}.querySelector(".risk-workbench__toolbar"))`)
      .catch(() => false);
    if (isRisk) return client;
    client.close();
  }
  return undefined;
}

async function inRiskFrame(bodySource) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const client = await riskFrame();
    if (client) {
      try {
        return await client.evaluate(`(function(){ const doc = ${INNER}; ${bodySource} })()`);
      } finally {
        client.close();
      }
    }
    // A hidden webview panel is torn down; re-activate its tab before retrying.
    if (attempt % 5 === 4) {
      const active = await pageOf();
      await active
        .locator(".tabs-container .tab", { hasText: /^Risk/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
    }
    await wait(600);
  }
  throw new Error("risk workbench webview not found");
}

const literal = (value) => JSON.stringify(JSON.stringify(value));

const readView = () =>
  inRiskFrame(`return {
    current: (doc.querySelector('.risk-workbench__toolbar [aria-current="page"]') || {}).textContent || null,
    heading: (doc.querySelector('h1') || {}).textContent || null,
    text: doc.body.innerText.replace(/\\s+/g, ' ')
  };`);

async function switchView(view) {
  await inRiskFrame(`const b = doc.querySelector('.risk-workbench__toolbar [data-risk-view=' + ${literal(view)} + ']');
    if (!b) throw new Error('no toolbar button'); b.click();`);
  await wait(2000);
}

async function clickCommand(command) {
  await inRiskFrame(`const b = doc.querySelector('button[data-command=' + ${literal(command)} + ']');
    if (!b) throw new Error('no button for ' + ${literal(command)}); b.click();`);
  await wait(1800);
}

async function setField(name, value) {
  await inRiskFrame(`const f = doc.querySelector('[name=' + ${literal(name)} + ']');
    if (!f) throw new Error('no field ' + ${literal(name)});
    if (f.type === 'checkbox') { f.checked = ${JSON.stringify(Boolean(value))}; }
    else { f.value = ${JSON.stringify(String(value))}; }
    const w = doc.defaultView;
    f.dispatchEvent(new w.Event('input', { bubbles: true }));
    f.dispatchEvent(new w.Event('change', { bubbles: true }));`);
  await wait(350);
}

const optionsOf = (name) =>
  inRiskFrame(`return [].slice.call(doc.querySelectorAll('[name=' + ${literal(name)} + '] option'))
    .map(function (o) { return { value: o.value, label: (o.textContent || '').trim() }; });`);

const metrics = () =>
  inRiskFrame(`const out = {};
    [].slice.call(doc.querySelectorAll('.metric')).forEach(function (m) {
      const key = ((m.querySelector('span') || {}).textContent || '?').trim().toUpperCase();
      out[key] = ((m.querySelector('strong') || {}).textContent || '').trim();
    });
    return out;`);

const fieldValue = (name) =>
  inRiskFrame(`const f = doc.querySelector('[name=' + ${literal(name)} + ']'); return f ? f.value : null;`);

const editorFormFieldNames = () =>
  inRiskFrame(`const f = doc.querySelector('form.form-grid'); if (!f) return [];
    return Array.from(new FormData(f).keys());`);

const inputNamesMatching = (prefix) =>
  inRiskFrame(`return [].slice.call(doc.querySelectorAll('input[name^=' + ${literal(prefix)} + ']'))
    .map(function (i) { return i.name; });`);

function record(name, detail) {
  steps.push({ step: name, ...detail });
  console.log(`ok  ${name}${detail && detail.note ? ` — ${detail.note}` : ""}`);
}

export {
  assert,
  clickCommand,
  closeAllEditors,
  closeOtherEditors,
  editorFormFieldNames,
  fieldValue,
  focusWorkbench,
  inRiskFrame,
  inputNamesMatching,
  join,
  metrics,
  mkdir,
  notifications,
  optionsOf,
  page,
  pageOf,
  readView,
  record,
  runCommand,
  setField,
  steps,
  switchView,
  tabs,
  wait,
  writeFile
};

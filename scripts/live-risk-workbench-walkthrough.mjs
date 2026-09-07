// Live operator walkthrough for the Workshop Risk workbench
// (docs/risk-overhaul-plan.md § Implementation and Verification Map item 5).
//
// NOT a CI gate: it drives a real VS Code Extension Development Host over the Chrome
// DevTools Protocol and needs a GUI session. The CI-safe subset of the same evidence
// lives in scripts/check-risk-workbench.mjs. Run this manually:
//
//   pnpm build
//   mkdir -p .tmp/edh/workspace .tmp/edh/user .tmp/edh/ext
//   code --extensionDevelopmentPath="$PWD/packages/core" \
//        --extensionDevelopmentPath="$PWD/packages/workshop" \
//        --user-data-dir="$PWD/.tmp/edh/user" --extensions-dir="$PWD/.tmp/edh/ext" \
//        --remote-debugging-port=9333 --disable-workspace-trust -n "$PWD/.tmp/edh/workspace"
//   node scripts/live-risk-workbench-walkthrough.mjs
//
// It initialises the scratch workspace, loads the enterprise sample, then walks
// create -> classify -> assess -> reuse an Action -> add a control -> inspect every
// visual -> record escalation -> produce a card, asserting against what the extension
// host actually persisted rather than against markup substrings.
import {
  assert,
  clickCommand,
  closeAllEditors,
  closeOtherEditors,
  editorFormFieldNames,
  fieldValue,
  inRiskFrame,
  inputNamesMatching,
  join,
  metrics,
  mkdir,
  notifications,
  optionsOf,
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
} from "./lib/edh-risk-workbench-driver.mjs";

const RISK_TITLE = "Phase 4B walkthrough risk";
const CONTROL_TITLE = "Removable media control (walkthrough)";

async function openRegister() {
  await closeAllEditors();
  await runCommand("PSPF: Open Risks List");
  await wait(3500);
}

async function openRecordByTitle(title) {
  await switchView("register");
  for (let attempt = 0; ; attempt += 1) {
    try {
      await inRiskFrame(`const rows = [].slice.call(doc.querySelectorAll('tr'));
        const row = rows.filter(function (r) { return r.textContent.indexOf(${JSON.stringify(title)}) !== -1; })[0];
        if (!row) throw new Error('no register row');
        const open = row.querySelector('button[data-command="openRecordInEditor"]');
        if (!open) throw new Error('no open button');
        open.click();`);
      break;
    } catch (error) {
      if (attempt >= 4) throw error;
      await wait(1500);
    }
  }
  await wait(2500);
  await closeOtherEditors();
}

// ---------------------------------------------------------------- 0. bootstrap
// Playwright's exit handling closes a CDP-connected browser, so bootstrap and the
// walkthrough must share one process and one connection.
await runCommand("PSPF: Initialise PSPF Workspace");
await wait(5000);
console.log("init:", await notifications());
await runCommand("PSPF: Load Sample Workspace");
await wait(8000);
console.log("sample:", await notifications());

// ---------------------------------------------------------------- 1. create
await openRegister();
console.log("tabs:", await tabs());
const opened = await readView();
assert.match(opened.heading ?? "", /Risk register/, `openRisksList should open the register, got ${opened.heading}`);
record("register-opens-in-place-of-quick-pick", { heading: opened.heading });

await runCommand("PSPF: Create Risk");
await wait(900);
await (await pageOf()).keyboard.type(RISK_TITLE, { delay: 5 });
await (await pageOf()).keyboard.press("Enter");
await wait(900);
await (await pageOf()).keyboard.press("Enter"); // status: Open
await wait(900);
await (await pageOf()).keyboard.type("4");
await wait(400);
await (await pageOf()).keyboard.press("Enter"); // likelihood
await wait(900);
await (await pageOf()).keyboard.type("4");
await wait(400);
await (await pageOf()).keyboard.press("Enter"); // impact
await wait(1000);
await (await pageOf()).keyboard.press("Enter"); // requirement set: All Requirements
await wait(1600);
await (await pageOf()).locator(".quick-input-list .monaco-list-row").first().click(); // tick one requirement
await wait(700);
await (await pageOf()).keyboard.press("Enter");
await wait(3500);
console.log("after create:", await notifications());

await openRegister();
const registerAfterCreate = await readView();
assert.ok(registerAfterCreate.text.includes(RISK_TITLE), "the new risk must appear in the register");
record("create-risk", { note: `"${RISK_TITLE}" present in the register` });

// ---------------------------------------------------------------- 2. classify
await openRecordByTitle(RISK_TITLE);
const submitted = await editorFormFieldNames();
for (const required of ["title", "status", "likelihood", "impact", "assessmentBasis", "primaryCategoryId"]) {
  assert.ok(
    submitted.includes(required),
    `the Risk editor form must submit ${required}; it submits ${submitted.join(", ")}`
  );
}
record("editor-form-submits-every-read-field", { fields: submitted });

const categories = await optionsOf("primaryCategoryId");
assert.ok(categories.length > 1, "framework categories must be offered on the record");
const category = categories.find((option) => /Technology/i.test(option.label)) ?? categories[1];
await setField("primaryCategoryId", category.value);
await setField("reference", "ERR-4099");
await setField("ownerTeam", "Digital Security");
await setField("causes", "Unencrypted removable media\nWeak device policy");
await setField("consequences", "Disclosure of OFFICIAL: Sensitive material");
await clickCommand("saveEntity");
await wait(2600);
await openRecordByTitle(RISK_TITLE);
const classifiedMetrics = await metrics();
assert.notEqual(classifiedMetrics.CATEGORY, "No category", "the saved primary category must resolve on the record");
assert.equal(await fieldValue("reference"), "ERR-4099", "reference must persist");
assert.equal(await fieldValue("ownerTeam"), "Digital Security", "owner team must persist");
const classified = await readView();
assert.ok(/Reclassified/i.test(classified.text), "a Core-derived reclassified event must be appended");
record("classify-risk", { category: classifiedMetrics.CATEGORY });

// ---------------------------------------------------------------- 3. assess
await setField("assessmentBasis", "legacy");
await setField("likelihood", "5");
await setField("impact", "4");
await setField("assessmentRationale", "Reassessed during the Phase 4B walkthrough.");
await clickCommand("saveEntity");
await wait(2600);
await openRecordByTitle(RISK_TITLE);
const assessed = await readView();
const assessedMetrics = await metrics();
assert.equal(assessedMetrics.BAND, "Extreme", `legacy 5x4 = 20 must evaluate to Extreme, got ${assessedMetrics.BAND}`);
assert.equal(await fieldValue("likelihood"), "5", "likelihood must persist");
assert.ok(/Reassessed/i.test(assessed.text), "a reassessed event must appear in History");
record("assess-current-legacy", {
  note: "legacy 5x4 -> Extreme; reassessed event derived by Core",
  metrics: assessedMetrics
});

const methodologies = await optionsOf("assessmentMethodologyRevision");
const cells = await optionsOf("assessmentCurrent");
assert.ok(methodologies.length > 0, "a methodology revision must be selectable");
const cellFor = (band) => cells.find((cell) => new RegExp(`${band}$`).test(cell.label));
const high = cellFor("High");
const low = cellFor("Low");
assert.ok(high && low, `matrix cells must be offered, got ${cells.length}`);
await setField("assessmentBasis", "custom");
await setField("assessmentCurrent", high.value);
await setField("assessmentInherent", high.value);
await setField("assessmentTarget", low.value);
await setField("assessmentRationale", "Custom current, inherent, and target recorded in the walkthrough.");
await clickCommand("saveEntity");
await wait(2600);
await openRecordByTitle(RISK_TITLE);
const customMetrics = await metrics();
assert.equal(await fieldValue("assessmentBasis"), "custom", "the custom basis must persist");
assert.equal(await fieldValue("assessmentTarget"), low.value, "the target cell must persist");
record("assess-custom-current-inherent-target", {
  methodology: methodologies[0]?.label ?? null,
  current: high.label,
  target: low.label,
  metrics: customMetrics
});

// appetite is workspace configuration, authored in the Framework view
await switchView("framework");
const frameworkView = await readView();
assert.match(frameworkView.heading ?? "", /framework/i, "framework view should open");
const appetiteBands = await inputNamesMatching("appetiteBand");
assert.ok(appetiteBands.length > 0, "appetite rule editor must offer band checkboxes");
for (const band of appetiteBands.filter((name) => /low|medium/i.test(name))) {
  await setField(band, true);
}
await setField("appetiteRationale", "Board tolerance recorded during the Phase 4B walkthrough.");
await clickCommand("saveRiskFrameworkAppetite");
await wait(2600);
record("assess-appetite", { bands: appetiteBands, note: "workspace appetite rule saved" });

await openRecordByTitle(RISK_TITLE);
const withAppetite = await metrics();
assert.ok(withAppetite.APPETITE, "the record must report a resolved appetite state");
record("appetite-resolves-on-record", { note: withAppetite.APPETITE });

// ---------------------------------------------------------------- 4. reuse an Action across two risks
await switchView("treatments");
const actionOptions = (await optionsOf("actionId")).filter((option) => option.value);
assert.ok(actionOptions.length > 0, "an existing Action must be offered for reuse");
const sharedAction = actionOptions.find((option) => /also treats|treat/i.test(option.label)) ?? actionOptions[0];
await setField("actionId", sharedAction.value);
await clickCommand("linkExistingActionToRisk");
await wait(2600);
await switchView("treatments");
const treatmentRows = await inRiskFrame(`return [].slice.call(doc.querySelectorAll('tr'))
  .map(function (r) { return r.innerText.replace(/\\s+/g, ' ').trim(); })
  .filter(function (t) { return t.length > 0; }).slice(0, 14);`);
record("reuse-action-across-two-risks", { linked: sharedAction.label, rows: treatmentRows.slice(0, 8) });

// ---------------------------------------------------------------- 5. control and application
await clickCommand("createRiskControl");
await wait(1600);
await (await pageOf()).keyboard.type(CONTROL_TITLE, { delay: 5 });
await (await pageOf()).keyboard.press("Enter");
await wait(1000);
await (await pageOf()).keyboard.type("Removable media is blocked by device policy.", { delay: 3 });
await (await pageOf()).keyboard.press("Enter");
await wait(1000);
await (await pageOf()).keyboard.type("Digital Security", { delay: 4 });
await (await pageOf()).keyboard.press("Enter");
await wait(1200);
await (await pageOf()).keyboard.press("Enter"); // state quick pick, first item
await wait(3200);
console.log("after control:", await notifications());

await switchView("treatments");
const controlOptions = (await optionsOf("controlId")).filter((option) => option.value);
const control = controlOptions.find((option) => /walkthrough/i.test(option.label));
assert.ok(control, `the created control must be selectable, got ${JSON.stringify(controlOptions)}`);
const anchors = await inputNamesMatching("anchor_");
assert.ok(anchors.length >= 3, `authored causes and consequences must be offered as anchors, got ${anchors.length}`);
await setField("controlId", control.value);
await setField("controlRole", "preventive");
await setField("controlEffectiveness", "partially-effective");
await setField("controlApplicability", "All managed endpoints");
await setField(anchors[0], true);
await clickCommand("mitigateRiskWithControl");
await wait(2600);
await switchView("treatments");
const withControl = await readView();
assert.ok(/Partially effective/i.test(withControl.text), "the control application effectiveness must render");
record("add-control-application", { control: control.label, anchors });

// ---------------------------------------------------------------- 6. inspect the visuals
const visuals = {};
for (const view of ["register", "hierarchy", "matrix", "bowtie", "coverage", "cards"]) {
  await switchView(view);
  const state = await readView();
  assert.ok(state.text.length > 200, `${view} view should render content`);
  visuals[view] = { heading: state.heading, characters: state.text.length };
}
await switchView("bowtie");
const bowtie = await readView();
assert.ok(/preventive/i.test(bowtie.text), "bow-tie must render its preventive column");
await switchView("coverage");
const coverage = await readView();
assert.ok(/Direct|Descendant/i.test(coverage.text), "coverage must distinguish direct from descendant");
record("inspect-visuals", visuals);

// ---------------------------------------------------------------- 7. escalation
await openRecordByTitle(RISK_TITLE);
const destinations = (await optionsOf("escalationDestinationRiskId")).filter((option) => option.value);
await setField("escalationState", "proposed");
if (destinations[0]) await setField("escalationDestinationRiskId", destinations[0].value);
await setField("escalationGovernanceLabel", "Security Governance Committee");
await setField("escalationReason", "Above appetite after the walkthrough reassessment.");
await clickCommand("recordRiskEscalation");
await wait(3200);
await openRecordByTitle(RISK_TITLE);
const escalated = await readView();
assert.ok(/Escalation/i.test(escalated.text), "an escalation event must appear in History");
const afterEscalation = await metrics();
assert.equal(afterEscalation.CATEGORY, classifiedMetrics.CATEGORY, "escalation must not change the risk's category");
record("record-escalation", { destination: destinations[0]?.label ?? null, note: "category unchanged by escalation" });

// ---------------------------------------------------------------- 8. produce a card
await switchView("cards");
const presets =
  await inRiskFrame(`return [].slice.call(doc.querySelectorAll('select[data-command="setRiskOutputPreset"] option'))
  .map(function (o) { return o.textContent.trim(); });`);
assert.ok(
  presets.length >= 2,
  `the cards view must offer Official and Official: Sensitive presets, got ${presets.join(", ")}`
);
const cardsView = await readView();
await clickCommand("copyRiskOutputText");
await wait(2200);
const { execFileSync } = await import("node:child_process");
const clipboard = execFileSync("pbpaste", { encoding: "utf8" });
assert.ok(
  clipboard.includes("OFFICIAL"),
  `the copied card must carry its classification, got: ${clipboard.slice(0, 200)}`
);
assert.ok(!/Digital Security/.test(clipboard), "an OFFICIAL preset must not carry the sensitive owner team");
assert.ok(
  !/Removable media is blocked/.test(clipboard),
  "an OFFICIAL preset must not carry sensitive control definitions"
);
record("produce-card", {
  presets,
  classification: /OFFICIAL[^\n]*/.exec(clipboard)?.[0] ?? null,
  clipboardCharacters: clipboard.length,
  cardsHeading: cardsView.heading
});

// ---------------------------------------------------------------- no-op / dirty / read-only
await openRecordByTitle(RISK_TITLE);
await clickCommand("saveEntity");
await wait(2200);
record("no-op-save", { notifications: (await notifications()).slice(-2) });

// ---------------------------------------------------------------- publication preflight (D6.3)
// The walkthrough leaves a custom-basis risk behind, so preflight must refuse to write.
// Team share is used rather than the master export because the latter opens a native
// save dialog this harness cannot drive.
await runCommand("PSPF Workshop: Export Team Share Bundle");
await wait(4500);
const preflight = (await notifications()).join(" | ");
assert.match(
  preflight,
  /cannot represent|custom|preflight|blocked/i,
  `publication preflight must block a custom-basis risk, got: ${preflight}`
);
record("publication-preflight", { notifications: (await notifications()).slice(-3) });

// Last, because an unanswered modal blocks everything after it.
await openRecordByTitle(RISK_TITLE);
await setField("description", "Dirty draft that should prompt before navigation.");
await inRiskFrame(`doc.querySelector('.risk-workbench__toolbar [data-risk-view="matrix"]').click();`);
await wait(2500);
// With the default native `window.dialogStyle` the confirmation is an OS dialog CDP
// cannot see, so accept either a visible dialog or a view that refused to switch;
// switching silently would discard the draft.
const prompt = await (
  await pageOf()
).evaluate(() => {
  const dialog = globalThis.document.querySelector(".monaco-dialog-box");
  return dialog ? dialog.innerText.replace(/\s+/g, " ").slice(0, 200) : null;
});
const viewAfterDirtyClick = await readView();
assert.ok(
  prompt || viewAfterDirtyClick.current !== "Matrix",
  "switching views with a dirty record must prompt; the view changed without a confirmation"
);
record("dirty-navigation-prompt", { prompt, viewAfterClick: viewAfterDirtyClick.current });
if (prompt) {
  await (await pageOf()).keyboard.press("Escape");
  await wait(600);
}

const reportDirectory = join(process.cwd(), ".tmp", "accessibility");
await mkdir(reportDirectory, { recursive: true });
const reportPath = join(reportDirectory, "risk-workbench-live-walkthrough.json");
await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), steps }, null, 2)}\n`, "utf8");
console.log(`\nreport: ${reportPath}`);
process.exit(0);

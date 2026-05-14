import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { POSTURE_BRIEF_BROWSER_SCRIPT } from "@pspf/brief-renderer";
import { PSPF_SLICE_VERSION, VERSION_AXES } from "@pspf/contracts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
await mkdir(dist, { recursive: true });

const html = `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PSPF Explorer</title>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #111113; color: #f4f4f5; }
    header { background: #18181b; color: #fafafa; border-bottom: 1px solid #3f3f46; padding: 12px 20px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    main { width: min(1680px, calc(100% - 48px)); margin: 0 auto; padding: 24px 0; }
    button, input { font: inherit; }
    button { background: #0f766e; color: #f0fdfa; border: 1px solid #14b8a6; border-radius: 6px; padding: 8px 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    button.secondary { background: #27272a; border-color: #52525b; color: #f4f4f5; }
    button:hover { background: #0d9488; }
    button:focus-visible { outline: 3px solid #38bdf8; outline-offset: 2px; }
    input, select { color: #f4f4f5; }
    select { background: #202024; border: 1px solid #52525b; border-radius: 6px; padding: 6px 8px; }
    input::file-selector-button { background: #27272a; color: #f4f4f5; border: 1px solid #52525b; border-radius: 6px; padding: 6px 10px; }
    input:focus-visible { outline: 3px solid #38bdf8; outline-offset: 2px; }
    a { color: #bae6fd; }
    a:focus-visible { outline: 3px solid #38bdf8; outline-offset: 2px; border-radius: 4px; }
    .banner { background: #3f2f11; border-bottom: 1px solid #d97706; color: #fde68a; padding: 8px 20px; font-weight: 600; }
    .panel { background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
    .section-nav { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: rgba(17, 17, 19, 0.92); border: 1px solid #3f3f46; border-radius: 6px; padding: 8px; margin: 0 0 16px; backdrop-filter: blur(10px); }
    .section-nav a, .section-nav button { color: #e4e4e7; text-decoration: none; border: 1px solid #3f3f46; background: #202024; border-radius: 6px; padding: 6px 10px; font-size: 14px; white-space: nowrap; font-weight: 600; }
    .section-nav a:hover, .section-nav button:hover { border-color: #38bdf8; background: #27272a; }
    details.panel { padding: 0; }
    details.panel > summary { list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; cursor: pointer; }
    details.panel > summary::-webkit-details-marker { display: none; }
    details.panel > summary h2 { margin: 0; }
    details.panel > summary::after { content: "Open"; border: 1px solid #3f3f46; border-radius: 999px; padding: 3px 8px; color: #d4d4d8; background: #202024; font-size: 12px; white-space: nowrap; }
    details.panel[open] > summary { border-bottom: 1px solid #3f3f46; }
    details.panel[open] > summary::after { content: "Close"; }
    .section-body { padding: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .metric { border: 1px solid #3f3f46; border-radius: 6px; padding: 12px; background: #202024; }
    .metric strong { display: block; font-size: 28px; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 12px 0; }
    .toolbar > * { min-width: 0; }
    .toolbar input, .toolbar select { max-width: 100%; }
    .local-authoring-grid { display: grid; grid-template-columns: minmax(260px, 360px) minmax(0, 1fr); gap: 16px; align-items: start; }
    .local-picker { border: 1px solid #3f3f46; border-radius: 6px; background: #202024; padding: 12px; position: sticky; top: 64px; }
    .local-picker input { box-sizing: border-box; width: 100%; background: #111113; border: 1px solid #52525b; border-radius: 6px; color: #f4f4f5; padding: 8px; }
    .local-requirement-list { display: grid; gap: 6px; max-height: min(54vh, 34rem); overflow: auto; margin-top: 10px; padding-right: 2px; }
    .local-requirement-option { width: 100%; display: grid; gap: 4px; text-align: left; background: #18181b; border-color: #3f3f46; color: #f4f4f5; white-space: normal; font-weight: 600; }
    .local-requirement-option[aria-pressed="true"] { border-color: #14b8a6; background: #134e4a; }
    .local-requirement-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; color: #d4d4d8; font-size: 12px; font-weight: 500; }
    .local-workspace { display: grid; gap: 14px; min-width: 0; }
    .local-card { border: 1px solid #3f3f46; border-radius: 6px; padding: 12px; background: #202024; }
    .local-card h3 { margin-top: 0; }
    .local-card select, .local-card input { background: #111113; border: 1px solid #52525b; border-radius: 6px; color: #f4f4f5; padding: 6px 8px; }
    .local-card .toolbar { align-items: end; }
    #local-evidence-requirement { width: min(30rem, 100%); }
    #local-evidence-title, #local-evidence-reference, #local-action-title, #local-action-due-date, #local-risk-title { width: min(20rem, 100%); }
    #local-action-requirement, #local-risk-requirement { width: min(30rem, 100%); }
    .version-strip { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
    .version-pill { border: 1px solid #3f3f46; border-radius: 999px; padding: 3px 8px; color: #d4d4d8; background: #202024; font-size: 12px; line-height: 1.4; white-space: nowrap; }
    .local-badge { border-color: #14b8a6; color: #ccfbf1; background: #134e4a; }
    .baseline-badge { border-color: #52525b; }
    .overview-grid { display: grid; grid-template-columns: minmax(220px, 320px) 1fr; gap: 16px; align-items: start; }
    .overview-grid > *, .bar-row > *, .panel, .panel-lite { min-width: 0; }
    .donut-wrap { display: grid; place-items: center; gap: 8px; }
    .donut { width: 210px; height: 210px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#22c55e 0 var(--met), #f59e0b var(--met) var(--partial), #f87171 var(--partial) var(--not-met), #71717a var(--not-met) 100%); }
    .donut-centre { width: 126px; height: 126px; border-radius: 50%; background: #18181b; display: grid; place-items: center; text-align: center; border: 1px solid #3f3f46; }
    .donut-centre strong { display: block; font-size: 30px; }
    .legend { display: grid; gap: 6px; font-size: 13px; }
    .legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; background: var(--swatch); }
    .bar-list { display: grid; gap: 10px; }
    .bar-row { display: grid; grid-template-columns: minmax(110px, 1fr) 2fr auto; gap: 10px; align-items: center; }
    .bar-track { height: 12px; background: #27272a; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; background: #22c55e; width: var(--value); }
    .check { display: inline-flex; align-items: center; justify-content: center; min-width: 4.75ch; box-sizing: border-box; border-radius: 999px; padding: 2px 8px; font-size: 12px; line-height: 1.35; font-weight: 700; white-space: nowrap; }
    .check.pass { background: #14532d; color: #dcfce7; }
    .check.fail { background: #7f1d1d; color: #fee2e2; }
    .table-wrap { width: 100%; overflow-x: auto; margin-top: 8px; }
    table { width: 100%; min-width: min(760px, 100%); border-collapse: collapse; table-layout: auto; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #3f3f46; vertical-align: top; }
    th { font-size: 13px; color: #d4d4d8; }
    td { overflow-wrap: anywhere; }
    th[data-field="title"], td[data-field="title"], th[data-field="requirement"], td[data-field="requirement"], th[data-field="control"], td[data-field="control"], th[data-field="from"], td[data-field="from"], th[data-field="to"], td[data-field="to"], th[data-field="target"], td[data-field="target"], th[data-field="explanation"], td[data-field="explanation"] { min-width: 18rem; max-width: 34rem; }
    th[data-field="controlId"], td[data-field="controlId"], th[data-field="coverage"], td[data-field="coverage"], th[data-field="profile"], td[data-field="profile"], th[data-field="confidence"], td[data-field="confidence"], th[data-field="reviewed"], td[data-field="reviewed"], th[data-field="drift"], td[data-field="drift"], th[data-field="release"], td[data-field="release"], th[data-field="status"], td[data-field="status"], th[data-field="responseState"], td[data-field="responseState"], th[data-field="reference"], td[data-field="reference"], th[data-field="total"], td[data-field="total"], th[data-field="postureUplift"], td[data-field="postureUplift"], th[data-field="evidenceUplift"], td[data-field="evidenceUplift"], th[data-field="riskReduction"], td[data-field="riskReduction"], th[data-field="directionUplift"], td[data-field="directionUplift"], th[data-field="urgency"], td[data-field="urgency"] { white-space: nowrap; width: 1%; }
    .validation-table th:nth-child(2), .validation-table td:nth-child(2) { width: 1%; white-space: nowrap; }
    .empty-value { color: #a1a1aa; font-style: italic; }
    code { color: #bae6fd; }
    .muted { color: #a1a1aa; }
    .footer { color: #a1a1aa; font-size: 13px; margin-top: 24px; }
    section { scroll-margin-top: 76px; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    @media (max-width: 720px) { .overview-grid, .bar-row, .local-authoring-grid { grid-template-columns: 1fr; } .local-picker { position: static; } main { width: calc(100% - 32px); padding: 16px 0; } table { min-width: 680px; } th[data-field="title"], td[data-field="title"], th[data-field="requirement"], td[data-field="requirement"], th[data-field="control"], td[data-field="control"], th[data-field="from"], td[data-field="from"], th[data-field="to"], td[data-field="to"] { min-width: 16rem; } }
  </style>
</head>
<body>
  <header role="banner"><strong>PSPF Explorer</strong><span>Publication + local authoring phase 1 · v${PSPF_SLICE_VERSION}</span></header>
  <div class="banner" role="status">OFFICIAL: Sensitive</div>
  <main>
    <section class="panel" aria-labelledby="bundle-heading">
      <h1>Published PSPF bundle</h1>
      <div class="version-strip" aria-label="PSPF version context"><span class="version-pill">PSPF v${PSPF_SLICE_VERSION}</span><span class="version-pill">Schema ${VERSION_AXES.schemaVersion}</span><span class="version-pill">Bundle ${VERSION_AXES.bundleVersion}</span><span class="version-pill">API ${VERSION_AXES.apiVersion}</span></div>
      <h2 id="bundle-heading" class="visually-hidden">Bundle input</h2>
      <p id="bundle-help" class="muted">Select the exported <code>bundle.json</code>. You can also select <code>data/manifest.json</code> with matching collection JSON files.</p>
      <label for="bundle-files">Bundle JSON files</label>
      <input id="bundle-files" type="file" multiple accept="application/json,.json" aria-describedby="bundle-help">
    </section>
    <nav class="section-nav" aria-label="Explorer sections" hidden>
      <a href="#summary">Overview</a>
      <a href="#validation">Validation</a>
      <a href="#local-authoring">Local Authoring</a>
      <a href="#requirements">Requirements</a>
      <a href="#evidence">Evidence</a>
      <a href="#actions">Actions</a>
      <a href="#action-impact">Action Impact</a>
      <a href="#risks">Risks</a>
      <a href="#directions">Directions</a>
      <a href="#source-controls">ISM Source Controls</a>
      <a href="#ism-coverage">ISM Coverage</a>
      <a href="#links">Relationships</a>
      <button type="button" id="close-all-sections">Close All</button>
    </nav>
    <section id="summary" class="panel" aria-live="polite" hidden></section>
    <details id="validation" class="panel" aria-live="polite" hidden></details>
    <details id="local-authoring" class="panel" aria-live="polite" hidden></details>
    <details id="requirements" class="panel" hidden></details>
    <details id="evidence" class="panel" hidden></details>
    <details id="actions" class="panel" hidden></details>
    <details id="action-impact" class="panel" hidden></details>
    <details id="risks" class="panel" hidden></details>
    <details id="directions" class="panel" hidden></details>
    <details id="source-controls" class="panel" hidden></details>
    <details id="ism-coverage" class="panel" hidden></details>
    <details id="links" class="panel" hidden></details>
    <p class="footer">PSPF source: protectivesecurity.gov.au · Essential Eight source: cyber.gov.au · ISM source: cyber.gov.au · ASD/ACSC · CC BY 4.0</p>
  </main>
  <script src="./brief-renderer.js"></script>
  <script src="./app.js"></script>
</body>
</html>
`;

const app = `const input = document.querySelector("#bundle-files");
const summary = document.querySelector("#summary");
const sectionNav = document.querySelector(".section-nav");
const validationSection = document.querySelector("#validation");
const localAuthoringSection = document.querySelector("#local-authoring");
const requirementsSection = document.querySelector("#requirements");
const evidenceSection = document.querySelector("#evidence");
const actionsSection = document.querySelector("#actions");
const actionImpactSection = document.querySelector("#action-impact");
const risksSection = document.querySelector("#risks");
const directionsSection = document.querySelector("#directions");
const sourceControlsSection = document.querySelector("#source-controls");
const ismCoverageSection = document.querySelector("#ism-coverage");
const linksSection = document.querySelector("#links");
let currentBriefInput;
let currentManifest;
let currentBaselineCollections;
let currentCollections;
let currentBundleKey;
let currentLocalOverlays = new Map();
let currentLocalEvidenceReferences = [];
let currentLocalActions = [];
let currentLocalRisks = [];
let currentLocalRequirementId;
let currentLocalRequirementFilter = "";
const localDbName = "pspf-explorer-local-v1";
const localStoreName = "requirement-status-overlays";
const localEvidenceStoreName = "requirement-evidence-references";
const localActionStoreName = "requirement-actions";
const localRiskStoreName = "requirement-risks";
const assessmentStatuses = ["not-started", "in-progress", "met", "partially-met", "not-met", "not-applicable", "under-review"];
const actionStatuses = ["todo", "in-progress", "blocked", "done", "cancelled"];
const riskStatuses = ["open", "monitored", "closed"];

sectionNav.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.closest("#close-all-sections")) {
    document.querySelectorAll("details.panel").forEach((section) => {
      section.open = false;
    });
    return;
  }
  const link = event.target instanceof HTMLElement ? event.target.closest('a[href^="#"]') : null;
  if (!link) {
    return;
  }
  const target = document.querySelector(link.getAttribute("href"));
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
  }
});

input.addEventListener("change", async () => {
  const files = Array.from(input.files || []);
  const byName = new Map(files.map((file) => [file.name, file]));
  const bundleFile = byName.get("bundle.json");
  if (bundleFile) {
    const bundle = await readJson(bundleFile);
    await render(bundle.manifest, bundle.collections || {});
    return;
  }

  const manifestFile = byName.get("manifest.json");
  if (!manifestFile) {
    alert("Select bundle.json, or select manifest.json plus the collection JSON files.");
    return;
  }

  const manifest = await readJson(manifestFile);
  const collections = {};
  const collectionTexts = {};
  for (const entry of manifest.collections || []) {
    const fileName = entry.path.split("/").pop();
    const file = byName.get(fileName);
    collectionTexts[entry.name] = file ? await readText(file) : undefined;
    collections[entry.name] = collectionTexts[entry.name] ? JSON.parse(collectionTexts[entry.name]) : [];
  }

  await render(manifest, collections, collectionTexts);
});

async function render(manifest, incomingCollections, collectionTexts = undefined) {
  currentManifest = manifest;
  currentBaselineCollections = cloneCollections(incomingCollections || {});
  currentBundleKey = bundleStorageKey(manifest);
  currentLocalOverlays = await loadLocalRequirementStatuses(currentBundleKey);
  currentLocalEvidenceReferences = await loadLocalEvidenceReferences(currentBundleKey);
  currentLocalActions = await loadLocalActions(currentBundleKey);
  currentLocalRisks = await loadLocalRisks(currentBundleKey);
  const collections = applyLocalEdits(currentBaselineCollections, currentLocalOverlays, currentLocalEvidenceReferences, currentLocalActions, currentLocalRisks);
  currentCollections = collections;
  const posture = collections.posture && collections.posture[0] ? collections.posture[0] : {};
  const validation = await validateBundle(manifest, currentBaselineCollections, collectionTexts);
  const domainsById = new Map((collections.domains || []).map((domain) => [domain.id, domain.title]));
  const relationshipSummary = summariseRelationships(collections.links || []);
  const requirementsById = new Map((collections.requirements || []).map((requirement) => [requirement.id, requirement]));
  const sourceControlsById = new Map((collections["source-controls"] || []).map((sourceControl) => [sourceControl.id, sourceControl]));
  const entitiesById = entityTitleMap(collections);
  const requirements = (collections.requirements || []).map((requirement) => ({
    ...requirement,
    domain: domainsById.get(requirement.domainId) || requirement.domainId,
    evidence: relationshipSummary.evidenceByRequirement.get(requirement.id) || 0,
    actions: relationshipSummary.actionsByRequirement.get(requirement.id) || 0,
    risks: relationshipSummary.risksByRequirement.get(requirement.id) || 0,
    statusSource: currentLocalOverlays.has(requirement.id) ? "Local" : "From bundle"
  }));
  const evidence = (collections.evidence || []).map((item) => ({
    ...item,
    requirements: titleList(relationshipSummary.requirementsByEvidence.get(item.id), requirementsById)
  }));
  const actions = (collections.actions || []).map((item) => ({
    ...item,
    dueDate: formatShortDate(item.dueDate) || item.dueDate,
    requirements: titleList(relationshipSummary.requirementsByAction.get(item.id), requirementsById)
  }));
  const risks = (collections.risks || []).map((item) => ({
    ...item,
    requirements: titleList(relationshipSummary.requirementsByRisk.get(item.id), requirementsById)
  }));
  const sourceControls = (collections["source-controls"] || []).map((item) => ({
    controlId: item.controlId,
    title: item.title,
    profiles: (item.profileTags || []).join(", "),
    release: item.provenance && item.provenance.oscalRelease || "unknown",
    drift: driftStatusLabel(item.statementChangeStatus)
  }));
  const ismCoverage = (collections["requirement-control-mappings"] || []).map((mapping) => {
    const requirement = requirementsById.get(mapping.requirementId);
    const sourceControl = sourceControlsById.get(mapping.sourceControlId);
    return {
      requirement: requirement ? requirement.title : compactEntityId(mapping.requirementId),
      controlId: sourceControl ? sourceControl.controlId : compactEntityId(mapping.sourceControlId),
      control: sourceControl ? sourceControl.title : "Source control not in bundle",
      coverage: label(mapping.coverageQualifier),
      profile: mapping.applicabilityProfile,
      confidence: label(mapping.confidence || "medium"),
      reviewed: mapping.lastReviewedAt ? formatDate(mapping.lastReviewedAt) : "Not recorded",
      reviewer: mapping.reviewBy || "Not recorded",
      drift: driftStatusLabel(sourceControl && sourceControl.statementChangeStatus),
      release: mapping.provenance && mapping.provenance.oscalRelease || "unknown"
    };
  });
  currentBriefInput = {
    generatedAt: manifest.generatedAt || new Date().toISOString(),
    requirements: collections.requirements || [],
    evidence: collections.evidence || [],
    actions: collections.actions || [],
    risks: collections.risks || [],
    links: collections.links || [],
    domains: collections.domains || [],
    directions: collections.directions || [],
    sourceLabel: "PSPF Explorer publication mode",
    bundleVersion: manifest.bundleVersion,
    schemaVersion: manifest.schemaVersion
  };
  const relationships = (collections.links || []).map((link) => ({
    title: link.title,
    relationship: label(link.linkType),
    from: entitiesById.get(link.fromId) || label(link.fromType),
    to: entitiesById.get(link.toId) || label(link.toType)
  }));
  sectionNav.hidden = false;
  summary.hidden = false;
  summary.innerHTML = '<h2>Posture Brief</h2>' +
    '<p><strong>' + escapeHtml(posture.title || "PSPF posture") + '</strong></p>' +
    versionStrip(manifest) +
    '<div class="toolbar"><button type="button" id="copy-brief">Copy posture brief</button><span id="copy-brief-status" class="muted" role="status"></span></div>' +
    '<div class="grid">' +
      metric("Requirements", (collections.requirements || []).length) +
      metric("Evidence", (collections.evidence || []).length) +
      metric("Actions", (collections.actions || []).length) +
      metric("Risks", (collections.risks || []).length) +
      metric("Directions", (collections.directions || []).length) +
      metric("ISM controls", (collections["source-controls"] || []).length) +
      metric("ISM mappings", (collections["requirement-control-mappings"] || []).length) +
    '</div>' +
    overview(requirements, collections) +
    '<p class="muted">Bundle ' + escapeHtml(manifest.bundleVersion) + " · Schema " + escapeHtml(manifest.schemaVersion) + " · Generated " + formatDate(manifest.generatedAt) + '</p>';
  document.querySelector("#copy-brief")?.addEventListener("click", copyPostureBrief);

  validationSection.hidden = false;
  renderExplorerSection(validationSection, "Bundle Validation", validationTable(validation));

  localAuthoringSection.hidden = false;
  renderExplorerSection(localAuthoringSection, "Local Authoring", localAuthoringPanel(requirements));
  bindLocalAuthoringControls();

  requirementsSection.hidden = false;
  renderExplorerSection(requirementsSection, "Requirements", table(requirements, ["title", "assessmentStatus", "statusSource", "domain", "evidence", "actions", "risks"]));

  evidenceSection.hidden = false;
  renderExplorerSection(evidenceSection, "Evidence", table(evidence, ["title", "evidenceType", "freshness", "requirements", "reference"]));

  actionsSection.hidden = false;
  renderExplorerSection(actionsSection, "Actions", table(actions, ["title", "status", "dueDate", "requirements"]));

  actionImpactSection.hidden = false;
  renderExplorerSection(actionImpactSection, "Action Impact ranking", '<p class="muted">Derived from linked requirements, evidence, risks, and Directions. Scoring is explainable and deterministic.</p>' + actionImpactTable(collections));

  risksSection.hidden = false;
  renderExplorerSection(risksSection, "Risks", table(risks, ["title", "status", "likelihood", "impact", "requirements"]));

  const directions = (collections.directions || []).map((direction) => ({
    reference: direction.reference,
    title: direction.title,
    responseState: label(direction.responseState),
    sourceAuthority: direction.sourceAuthority || "Not recorded",
    issuedAt: direction.issuedAt ? formatDate(direction.issuedAt) : "Not recorded"
  }));
  directionsSection.hidden = false;
  renderExplorerSection(directionsSection, "Directions", '<p class="muted">Authoritative Directions overlay PSPF Requirements; once registered they always apply.</p>' + table(directions, ["reference", "title", "responseState", "sourceAuthority", "issuedAt"]));

  sourceControlsSection.hidden = false;
  renderExplorerSection(sourceControlsSection, "ISM Source Controls", '<p class="muted">ISM source: cyber.gov.au · ASD/ACSC · CC BY 4.0.</p>' + table(sourceControls, ["controlId", "title", "profiles", "release", "drift"]));

  ismCoverageSection.hidden = false;
  renderExplorerSection(ismCoverageSection, "ISM Coverage", table(ismCoverage, ["requirement", "controlId", "control", "coverage", "profile", "confidence", "reviewed", "reviewer", "drift", "release"]));

  linksSection.hidden = false;
  renderExplorerSection(linksSection, "Relationships Board", table(relationships, ["title", "relationship", "from", "to"]));
}

function renderExplorerSection(section, heading, body, open = false) {
  const shouldOpen = section.open || open;
  section.innerHTML = '<summary><h2>' + escapeHtml(heading) + '</h2></summary><div class="section-body">' + body + '</div>';
  section.open = shouldOpen;
}

function versionStrip(manifest) {
  return '<div class="version-strip" aria-label="Loaded version context">' +
    '<span class="version-pill">PSPF v${PSPF_SLICE_VERSION}</span>' +
    '<span class="version-pill">Schema ' + escapeHtml(manifest.schemaVersion || "missing") + '</span>' +
    '<span class="version-pill">Bundle ' + escapeHtml(manifest.bundleVersion || "missing") + '</span>' +
    '<span class="version-pill">API ' + escapeHtml(manifest.apiVersion || "missing") + '</span>' +
    '</div>';
}

async function copyPostureBrief() {
  const status = document.querySelector("#copy-brief-status");
  try {
    if (!currentBriefInput || !globalThis.pspfBriefRenderer) {
      throw new Error("Posture brief renderer is not ready.");
    }
    const brief = globalThis.pspfBriefRenderer.renderPostureBriefMarkdown(currentBriefInput);
    await writeClipboardText(brief);
    if (status) {
      status.textContent = "Copied.";
    }
  } catch (error) {
    if (status) {
      status.textContent = "Copy failed. Select the text from the generated brief instead.";
    }
    console.error(error);
  }
}

async function writeClipboardText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("Clipboard fallback failed.");
  }
}

async function validateBundle(manifest, collections, collectionTexts) {
  const expectedCollections = ["domains", "requirements", "evidence", "actions", "risks", "snapshots", "links", "tags", "source-controls", "requirement-control-mappings", "directions", "posture"];
  const checks = [
    check("Bundle version", manifest.bundleVersion === "${VERSION_AXES.bundleVersion}", manifest.bundleVersion || "missing"),
    check("Schema version", manifest.schemaVersion === "${VERSION_AXES.schemaVersion}", manifest.schemaVersion || "missing"),
    check("API version", manifest.apiVersion === "${VERSION_AXES.apiVersion}", manifest.apiVersion || "missing"),
    check("Generator mode", manifest.generator && ["publication", "local-authoring"].includes(manifest.generator.mode), manifest.generator && manifest.generator.mode || "missing"),
    check("Classification", manifest.security && manifest.security.classification === "OFFICIAL: Sensitive", manifest.security && manifest.security.classification || "missing")
  ];

  const manifestNames = (manifest.collections || []).map((entry) => entry.name);
  checks.push(check("Collection contract", JSON.stringify(manifestNames) === JSON.stringify(expectedCollections), manifestNames.join(", ")));

  for (const entry of manifest.collections || []) {
    const records = collections[entry.name] || [];
    checks.push(check(entry.name + " count", entry.count === records.length, String(records.length)));
    const text = collectionTexts && collectionTexts[entry.name] ? collectionTexts[entry.name] : JSON.stringify(records, null, 2) + "\\n";
    const hash = await sha256(text);
    checks.push(check(entry.name + " hash", hash === (entry.hash && entry.hash.value), hash.slice(0, 12)));
  }

  const posture = collections.posture && collections.posture[0] ? collections.posture[0] : {};
  checks.push(check("Posture requirements", posture.requirementCount === (collections.requirements || []).length, String(posture.requirementCount || 0)));
  checks.push(check("Posture evidence", posture.evidenceCount === (collections.evidence || []).length, String(posture.evidenceCount || 0)));
  checks.push(check("Posture actions", posture.actionCount === (collections.actions || []).length, String(posture.actionCount || 0)));
  checks.push(check("Posture risks", posture.riskCount === (collections.risks || []).length, String(posture.riskCount || 0)));
  checks.push(check("Posture ISM controls", posture.sourceControlCount === (collections["source-controls"] || []).length, String(posture.sourceControlCount || 0)));
  checks.push(check("Posture ISM mappings", posture.requirementControlMappingCount === (collections["requirement-control-mappings"] || []).length, String(posture.requirementControlMappingCount || 0)));
  checks.push(check("Mapping rationale excluded", !containsPath(collections["requirement-control-mappings"] || [], ["rationale"]), "default deny"));
  const mappings = collections["requirement-control-mappings"] || [];
  const validConfidence = new Set(["low", "medium", "high"]);
  checks.push(check("Mapping confidence present", mappings.every((mapping) => validConfidence.has(mapping.confidence)), mappings.length + " mapping(s)"));
  checks.push(check("Mapping review dates valid", mappings.every((mapping) => !mapping.lastReviewedAt || !Number.isNaN(Date.parse(mapping.lastReviewedAt))), "optional date-time"));
  const validDriftStatus = new Set(["unchanged", "changed", "new", "removed"]);
  const sourceControls = collections["source-controls"] || [];
  checks.push(check("Source-control drift status", sourceControls.every((sourceControl) => validDriftStatus.has(sourceControl.statementChangeStatus)), sourceControls.length + " source control(s)"));

  const disallowed = ["person.name", "person.email", "assignment.personId"];
  for (const fieldPath of disallowed) {
    checks.push(check("Excludes " + fieldPath, !containsPath({ manifest, collections }, fieldPath.split(".")), "default deny"));
  }

  return checks;
}

function localAuthoringPanel(requirements) {
  const selectedRequirement = selectedLocalRequirement(requirements);
  const selectedBaseline = baselineRequirement(selectedRequirement?.id);
  const selectedOverlay = selectedRequirement ? currentLocalOverlays.get(selectedRequirement.id) : undefined;
  const selectedConflict = selectedOverlay && selectedBaseline && selectedOverlay.baselineStatus !== selectedBaseline.assessmentStatus;
  const localCount = currentLocalOverlays.size;
  const conflictCount = localStatusConflicts().length;
  const localEvidenceCount = currentLocalEvidenceReferences.length;
  const localActionCount = currentLocalActions.length;
  const localRiskCount = currentLocalRisks.length;
  const rows = requirements.map((requirement) => {
    const baseline = baselineRequirement(requirement.id);
    const overlay = currentLocalOverlays.get(requirement.id);
    const conflict = overlay && baseline && overlay.baselineStatus !== baseline.assessmentStatus;
    return {
      title: requirement.title,
      baseline: label(baseline?.assessmentStatus || requirement.assessmentStatus),
      local: label(requirement.assessmentStatus),
      source: currentLocalOverlays.has(requirement.id) ? '<span class="version-pill local-badge">local</span>' : '<span class="version-pill baseline-badge">from bundle</span>',
      conflict: conflict ? '<span class="check fail">Baseline changed</span>' : '<span class="muted">None</span>'
    };
  });
  return '<div class="toolbar">' +
    '<button type="button" id="export-local-bundle">Export local JSON</button>' +
    '<button type="button" class="secondary" id="reset-local-data">Reset local data</button>' +
    '<span id="local-storage-status" class="muted" role="status">IndexedDB checking storage...</span>' +
    '</div>' +
    '<p class="muted">Local status overlays: ' + localCount + '</p>' +
    '<p class="muted">Local status conflicts: ' + conflictCount + '</p>' +
    '<div class="local-authoring-grid">' +
      '<aside class="local-picker" aria-label="Requirement picker">' +
        '<label for="local-requirement-filter">Find Requirement</label>' +
        '<input id="local-requirement-filter" type="search" placeholder="Search title, ID, status, or domain" autocomplete="off" value="' + escapeHtml(currentLocalRequirementFilter) + '">' +
        '<div class="local-requirement-list" id="local-requirement-list">' + localRequirementButtons(requirements, selectedRequirement?.id) + '</div>' +
        '<p id="local-requirement-empty" class="muted"' + (matchingLocalRequirements(requirements).length === 0 ? '' : ' hidden') + '>No matching Requirements.</p>' +
      '</aside>' +
      '<div class="local-workspace">' +
        '<section class="local-card" aria-labelledby="local-selected-heading">' +
          '<h3 id="local-selected-heading">Selected Requirement</h3>' +
          '<p><strong>' + escapeHtml(selectedRequirement?.title || "No Requirement selected") + '</strong></p>' +
          '<p class="muted">Baseline: ' + escapeHtml(label(selectedBaseline?.assessmentStatus || selectedRequirement?.assessmentStatus || "not-started")) + ' · Local: ' + escapeHtml(label(selectedRequirement?.assessmentStatus || "not-started")) + (selectedConflict ? ' · <span class="check fail">Baseline changed</span>' : '') + '</p>' +
          (selectedRequirement ? '<div class="toolbar"><label for="local-selected-status">Status</label>' + statusSelect(selectedRequirement.id, selectedRequirement.assessmentStatus, "local-selected-status") + '</div>' : '') +
        '</section>' +
        '<section class="local-card" aria-labelledby="local-evidence-heading">' +
          '<h3 id="local-evidence-heading">Add Evidence Reference</h3>' +
          '<div class="toolbar">' +
            '<label for="local-evidence-title">Title</label><input id="local-evidence-title" type="text" value="Local evidence reference">' +
            '<label for="local-evidence-reference">Reference</label><input id="local-evidence-reference" type="text" placeholder="Document path or URL">' +
            '<button type="button" id="add-local-evidence">Add evidence</button>' +
          '</div>' +
          '<p class="muted">Local evidence references: ' + localEvidenceCount + '</p>' +
          table(localEvidenceRows(selectedRequirement?.id), ["title", "requirement", "reference", "source"]) +
        '</section>' +
        '<section class="local-card" aria-labelledby="local-action-heading">' +
          '<h3 id="local-action-heading">Add Action</h3>' +
          '<div class="toolbar">' +
            '<label for="local-action-title">Title</label><input id="local-action-title" type="text" value="Local follow-up action">' +
            '<label for="local-action-status">Status</label>' + actionStatusSelect() +
            '<label for="local-action-due-date">Due date</label><input id="local-action-due-date" type="date">' +
            '<button type="button" id="add-local-action">Add action</button>' +
          '</div>' +
          '<p class="muted">Local actions: ' + localActionCount + '</p>' +
          table(localActionRows(selectedRequirement?.id), ["title", "requirement", "status", "dueDate", "source"]) +
        '</section>' +
        '<section class="local-card" aria-labelledby="local-risk-heading">' +
          '<h3 id="local-risk-heading">Add Risk</h3>' +
          '<div class="toolbar">' +
            '<label for="local-risk-title">Title</label><input id="local-risk-title" type="text" value="Local risk">' +
            '<label for="local-risk-status">Status</label>' + riskStatusSelect() +
            '<label for="local-risk-likelihood">Likelihood</label>' + scoreSelect("local-risk-likelihood", 3) +
            '<label for="local-risk-impact">Impact</label>' + scoreSelect("local-risk-impact", 3) +
            '<button type="button" id="add-local-risk">Add risk</button>' +
          '</div>' +
          '<p class="muted">Local risks: ' + localRiskCount + '</p>' +
          table(localRiskRows(selectedRequirement?.id), ["title", "requirement", "status", "likelihood", "impact", "source"]) +
        '</section>' +
      '</div>' +
    '</div>' +
    '<details class="local-card"><summary><strong>All local status overlays</strong></summary>' + tableHtml(rows, ["title", "baseline", "local", "source", "conflict"]) + '</details>';
}

function bindLocalAuthoringControls() {
  localAuthoringSection.querySelectorAll("select[data-requirement-id]").forEach((select) => {
    select.addEventListener("change", async () => {
      currentLocalRequirementId = select.dataset.requirementId;
      await setLocalRequirementStatus(select.dataset.requirementId, select.value);
    });
  });
  localAuthoringSection.querySelectorAll(".local-requirement-option").forEach((button) => {
    button.addEventListener("click", async () => {
      currentLocalRequirementId = button.dataset.requirementId;
      await render(currentManifest, currentBaselineCollections);
    });
  });
  localAuthoringSection.querySelector("#local-requirement-filter")?.addEventListener("input", async (event) => {
    currentLocalRequirementFilter = String(event.target?.value || "");
    const nextRequirementId = filterLocalRequirementList(currentLocalRequirementFilter);
    if (nextRequirementId !== undefined && nextRequirementId !== currentLocalRequirementId) {
      currentLocalRequirementId = nextRequirementId || undefined;
      await render(currentManifest, currentBaselineCollections);
    }
  });
  localAuthoringSection.querySelector("#export-local-bundle")?.addEventListener("click", async () => {
    const bundle = await exportLocalAuthoringBundle();
    downloadJson("pspf-explorer-local-authoring-bundle.json", bundle);
  });
  localAuthoringSection.querySelector("#reset-local-data")?.addEventListener("click", async () => {
    if (confirm("Reset local Explorer data for this bundle? Export local JSON first if you need to keep it.")) {
      await resetLocalData(currentBundleKey);
      await render(currentManifest, currentBaselineCollections);
    }
  });
  localAuthoringSection.querySelector("#add-local-evidence")?.addEventListener("click", async () => {
    const requirementId = currentLocalRequirementId;
    const title = localAuthoringSection.querySelector("#local-evidence-title")?.value;
    const reference = localAuthoringSection.querySelector("#local-evidence-reference")?.value;
    await addLocalEvidenceReference(requirementId, title, reference);
  });
  localAuthoringSection.querySelector("#add-local-action")?.addEventListener("click", async () => {
    const requirementId = currentLocalRequirementId;
    const title = localAuthoringSection.querySelector("#local-action-title")?.value;
    const status = localAuthoringSection.querySelector("#local-action-status")?.value;
    const dueDate = localAuthoringSection.querySelector("#local-action-due-date")?.value;
    await addLocalAction(requirementId, title, status, dueDate);
  });
  localAuthoringSection.querySelector("#add-local-risk")?.addEventListener("click", async () => {
    const requirementId = currentLocalRequirementId;
    const title = localAuthoringSection.querySelector("#local-risk-title")?.value;
    const status = localAuthoringSection.querySelector("#local-risk-status")?.value;
    const likelihood = Number(localAuthoringSection.querySelector("#local-risk-likelihood")?.value || 3);
    const impact = Number(localAuthoringSection.querySelector("#local-risk-impact")?.value || 3);
    await addLocalRisk(requirementId, title, status, likelihood, impact);
  });
  updateStorageStatus();
}

function requirementSelect(requirements, id = "local-evidence-requirement") {
  const options = requirements.map((requirement) => '<option value="' + escapeHtml(requirement.id) + '">' + escapeHtml(requirement.title) + '</option>').join("");
  return '<select id="' + escapeHtml(id) + '">' + options + '</select>';
}

function selectedLocalRequirement(requirements) {
  const matches = matchingLocalRequirements(requirements);
  if (!matches.length) {
    currentLocalRequirementId = undefined;
    return undefined;
  }
  let selected = matches.find((requirement) => requirement.id === currentLocalRequirementId);
  if (!selected) {
    selected = matches.find((requirement) => currentLocalOverlays.has(requirement.id)) || matches[0];
    currentLocalRequirementId = selected.id;
  }
  return selected;
}

function matchingLocalRequirements(requirements) {
  const needle = currentLocalRequirementFilter.trim().toLowerCase();
  if (!needle) {
    return requirements;
  }
  return requirements.filter((requirement) => localRequirementSearchText(requirement).includes(needle));
}

function localRequirementButtons(requirements, selectedRequirementId) {
  return requirements.map((requirement) => {
    const baseline = baselineRequirement(requirement.id);
    const overlay = currentLocalOverlays.get(requirement.id);
    const conflict = overlay && baseline && overlay.baselineStatus !== baseline.assessmentStatus;
    const badges = [label(requirement.assessmentStatus), requirement.domain || "No domain"];
    if (currentLocalOverlays.has(requirement.id)) {
      badges.push("local status");
    }
    if (conflict) {
      badges.push("conflict");
    }
    const matchesFilter = matchingLocalRequirements([requirement]).length > 0;
    return '<button type="button" class="local-requirement-option" data-requirement-id="' + escapeHtml(requirement.id) + '" data-search="' + escapeHtml(localRequirementSearchText(requirement)) + '" aria-pressed="' + (requirement.id === selectedRequirementId ? "true" : "false") + '"' + (matchesFilter ? '' : ' hidden') + '>' +
      '<span>' + escapeHtml(requirement.title) + '</span>' +
      '<span class="local-requirement-meta">' + badges.map((badge) => '<span class="version-pill' + (badge === "local status" ? " local-badge" : "") + '">' + escapeHtml(badge) + '</span>').join("") + '</span>' +
    '</button>';
  }).join("");
}

function filterLocalRequirementList(query) {
  const needle = query.trim().toLowerCase();
  let firstVisibleRequirementId;
  let currentVisible = false;
  localAuthoringSection.querySelectorAll(".local-requirement-option").forEach((button) => {
    const visible = needle.length === 0 || String(button.dataset.search || "").includes(needle);
    button.hidden = !visible;
    if (visible && !firstVisibleRequirementId) {
      firstVisibleRequirementId = button.dataset.requirementId;
    }
    if (visible && button.dataset.requirementId === currentLocalRequirementId) {
      currentVisible = true;
    }
  });
  const empty = localAuthoringSection.querySelector("#local-requirement-empty");
  if (empty) {
    empty.hidden = Boolean(firstVisibleRequirementId);
  }
  return currentVisible ? undefined : firstVisibleRequirementId || "";
}

function localRequirementSearchText(requirement) {
  return [requirement.title, requirement.assessmentStatus, requirement.domain, requirement.id].join(" ").toLowerCase();
}

function actionStatusSelect() {
  const options = actionStatuses.map((status) => '<option value="' + escapeHtml(status) + '">' + escapeHtml(label(status)) + '</option>').join("");
  return '<select id="local-action-status">' + options + '</select>';
}

function riskStatusSelect() {
  const options = riskStatuses.map((status) => '<option value="' + escapeHtml(status) + '">' + escapeHtml(label(status)) + '</option>').join("");
  return '<select id="local-risk-status">' + options + '</select>';
}

function scoreSelect(id, selected) {
  const options = [1, 2, 3, 4, 5].map((score) => '<option value="' + score + '"' + (score === selected ? " selected" : "") + '>' + score + '</option>').join("");
  return '<select id="' + escapeHtml(id) + '">' + options + '</select>';
}

function localEvidenceRows(requirementId) {
  const requirementsById = new Map((currentBaselineCollections?.requirements || []).map((requirement) => [requirement.id, requirement]));
  return currentLocalEvidenceReferences.filter((reference) => !requirementId || reference.requirementId === requirementId).map((reference) => ({
    title: reference.title,
    requirement: requirementsById.get(reference.requirementId)?.title || reference.requirementId,
    reference: reference.reference,
    source: '<span class="version-pill local-badge">local</span>'
  }));
}

function localActionRows(requirementId) {
  const requirementsById = new Map((currentBaselineCollections?.requirements || []).map((requirement) => [requirement.id, requirement]));
  return currentLocalActions.filter((action) => !requirementId || action.requirementId === requirementId).map((action) => ({
    title: action.title,
    requirement: requirementsById.get(action.requirementId)?.title || action.requirementId,
    status: label(action.status),
    dueDate: action.dueDate ? formatShortDate(action.dueDate) || action.dueDate : "Not recorded",
    source: '<span class="version-pill local-badge">local</span>'
  }));
}

function localRiskRows(requirementId) {
  const requirementsById = new Map((currentBaselineCollections?.requirements || []).map((requirement) => [requirement.id, requirement]));
  return currentLocalRisks.filter((risk) => !requirementId || risk.requirementId === requirementId).map((risk) => ({
    title: risk.title,
    requirement: requirementsById.get(risk.requirementId)?.title || risk.requirementId,
    status: label(risk.status),
    likelihood: risk.likelihood,
    impact: risk.impact,
    source: '<span class="version-pill local-badge">local</span>'
  }));
}

function statusSelect(requirementId, selected, id) {
  const options = assessmentStatuses.map((status) => '<option value="' + escapeHtml(status) + '"' + (status === selected ? " selected" : "") + '>' + escapeHtml(label(status)) + '</option>').join("");
  return '<select' + (id ? ' id="' + escapeHtml(id) + '"' : '') + ' data-requirement-id="' + escapeHtml(requirementId) + '" aria-label="Assessment status for ' + escapeHtml(requirementId) + '">' + options + '</select>';
}

async function setLocalRequirementStatus(requirementId, assessmentStatus) {
  if (!requirementId || !assessmentStatuses.includes(assessmentStatus)) {
    return;
  }
  const baseline = baselineRequirement(requirementId);
  if (!baseline) {
    return;
  }
  if (baseline.assessmentStatus === assessmentStatus) {
    await deleteLocalRequirementStatus(currentBundleKey, requirementId);
  } else {
    await saveLocalRequirementStatus({
      key: currentBundleKey + "::" + requirementId,
      bundleKey: currentBundleKey,
      requirementId,
      baselineStatus: baseline.assessmentStatus,
      assessmentStatus,
      updatedAt: new Date().toISOString()
    });
  }
  await render(currentManifest, currentBaselineCollections);
}

function baselineRequirement(requirementId) {
  return (currentBaselineCollections?.requirements || []).find((requirement) => requirement.id === requirementId);
}

function localStatusConflicts() {
  const conflicts = [];
  for (const overlay of currentLocalOverlays.values()) {
    const baseline = baselineRequirement(overlay.requirementId);
    if (baseline && overlay.baselineStatus !== baseline.assessmentStatus) {
      conflicts.push({ overlay, baseline });
    }
  }
  return conflicts;
}

function applyLocalEdits(collections, overlays, evidenceReferences, localActions, localRisks) {
  const clone = cloneCollections(collections);
  clone.requirements = (clone.requirements || []).map((requirement) => {
    const overlay = overlays.get(requirement.id);
    if (!overlay) {
      return requirement;
    }
    return {
      ...requirement,
      assessmentStatus: overlay.assessmentStatus,
      updatedAt: overlay.updatedAt,
      sourceProduct: "explorer"
    };
  });
  for (const evidenceReference of evidenceReferences) {
    const materialised = materialiseLocalEvidenceReference(evidenceReference);
    if (!(clone.evidence || []).some((item) => item.id === materialised.evidence.id)) {
      clone.evidence = [...(clone.evidence || []), materialised.evidence];
    }
    if (!(clone.links || []).some((item) => item.id === materialised.link.id)) {
      clone.links = [...(clone.links || []), materialised.link];
    }
  }
  for (const localAction of localActions) {
    const materialised = materialiseLocalAction(localAction);
    if (!(clone.actions || []).some((item) => item.id === materialised.action.id)) {
      clone.actions = [...(clone.actions || []), materialised.action];
    }
    if (!(clone.links || []).some((item) => item.id === materialised.link.id)) {
      clone.links = [...(clone.links || []), materialised.link];
    }
  }
  for (const localRisk of localRisks) {
    const materialised = materialiseLocalRisk(localRisk);
    if (!(clone.risks || []).some((item) => item.id === materialised.risk.id)) {
      clone.risks = [...(clone.risks || []), materialised.risk];
    }
    if (!(clone.links || []).some((item) => item.id === materialised.link.id)) {
      clone.links = [...(clone.links || []), materialised.link];
    }
  }
  clone.posture = (clone.posture || []).map((posture) => ({
    ...posture,
    updatedAt: new Date().toISOString(),
    sourceProduct: "explorer",
    requirementCount: (clone.requirements || []).length,
    evidenceCount: (clone.evidence || []).length,
    actionCount: (clone.actions || []).length,
    riskCount: (clone.risks || []).length,
    sourceControlCount: (clone["source-controls"] || []).length,
    requirementControlMappingCount: (clone["requirement-control-mappings"] || []).length,
    directionCount: (clone.directions || []).length
  }));
  return clone;
}

async function addLocalRisk(requirementId, title, status, likelihood, impact) {
  const requirement = baselineRequirement(requirementId);
  const cleanTitle = String(title || "").trim();
  const cleanStatus = riskStatuses.includes(status) ? status : "open";
  const cleanLikelihood = clampScore(likelihood);
  const cleanImpact = clampScore(impact);
  if (!requirement || !cleanTitle) {
    return;
  }
  const timestamp = new Date().toISOString();
  const token = crypto.randomUUID();
  await saveLocalRisk({
    key: currentBundleKey + "::" + token,
    bundleKey: currentBundleKey,
    requirementId,
    riskId: "RSK-" + token,
    linkId: "LNK-" + crypto.randomUUID(),
    title: cleanTitle,
    status: cleanStatus,
    likelihood: cleanLikelihood,
    impact: cleanImpact,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await render(currentManifest, currentBaselineCollections);
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 3;
  }
  return Math.max(1, Math.min(5, Math.round(number)));
}

function materialiseLocalRisk(record) {
  const timestamp = record.updatedAt || new Date().toISOString();
  return {
    risk: {
      id: record.riskId,
      entityType: "risk",
      schemaVersion: "${VERSION_AXES.schemaVersion}",
      title: record.title,
      createdAt: record.createdAt || timestamp,
      updatedAt: timestamp,
      sourceProduct: "explorer",
      recordStatus: "active",
      status: record.status || "open",
      likelihood: clampScore(record.likelihood),
      impact: clampScore(record.impact)
    },
    link: {
      id: record.linkId,
      entityType: "link",
      schemaVersion: "${VERSION_AXES.schemaVersion}",
      title: "Local risk exposes requirement",
      createdAt: record.createdAt || timestamp,
      updatedAt: timestamp,
      sourceProduct: "explorer",
      recordStatus: "active",
      linkType: "exposed-by",
      fromId: record.requirementId,
      fromType: "requirement",
      toId: record.riskId,
      toType: "risk"
    }
  };
}

async function addLocalAction(requirementId, title, status, dueDate) {
  const requirement = baselineRequirement(requirementId);
  const cleanTitle = String(title || "").trim();
  const cleanStatus = actionStatuses.includes(status) ? status : "todo";
  if (!requirement || !cleanTitle) {
    return;
  }
  const timestamp = new Date().toISOString();
  const token = crypto.randomUUID();
  await saveLocalAction({
    key: currentBundleKey + "::" + token,
    bundleKey: currentBundleKey,
    requirementId,
    actionId: "ACT-" + token,
    linkId: "LNK-" + crypto.randomUUID(),
    title: cleanTitle,
    status: cleanStatus,
    dueDate: String(dueDate || "").trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await render(currentManifest, currentBaselineCollections);
}

function materialiseLocalAction(record) {
  const timestamp = record.updatedAt || new Date().toISOString();
  const action = {
    id: record.actionId,
    entityType: "action",
    schemaVersion: "${VERSION_AXES.schemaVersion}",
    title: record.title,
    createdAt: record.createdAt || timestamp,
    updatedAt: timestamp,
    sourceProduct: "explorer",
    recordStatus: "active",
    status: record.status || "todo"
  };
  if (record.dueDate) {
    action.dueDate = record.dueDate;
  }
  return {
    action,
    link: {
      id: record.linkId,
      entityType: "link",
      schemaVersion: "${VERSION_AXES.schemaVersion}",
      title: "Local action addresses requirement",
      createdAt: record.createdAt || timestamp,
      updatedAt: timestamp,
      sourceProduct: "explorer",
      recordStatus: "active",
      linkType: "addressed-by",
      fromId: record.requirementId,
      fromType: "requirement",
      toId: record.actionId,
      toType: "action"
    }
  };
}

async function addLocalEvidenceReference(requirementId, title, reference) {
  const requirement = baselineRequirement(requirementId);
  const cleanTitle = String(title || "").trim();
  const cleanReference = String(reference || "").trim();
  if (!requirement || !cleanTitle || !cleanReference) {
    return;
  }
  const timestamp = new Date().toISOString();
  const token = crypto.randomUUID();
  await saveLocalEvidenceReference({
    key: currentBundleKey + "::" + token,
    bundleKey: currentBundleKey,
    requirementId,
    evidenceId: "EVD-" + token,
    linkId: "LNK-" + crypto.randomUUID(),
    title: cleanTitle,
    reference: cleanReference,
    evidenceType: cleanReference.startsWith("http://") || cleanReference.startsWith("https://") ? "url" : "document",
    freshness: "unknown",
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await render(currentManifest, currentBaselineCollections);
}

function materialiseLocalEvidenceReference(record) {
  const timestamp = record.updatedAt || new Date().toISOString();
  return {
    evidence: {
      id: record.evidenceId,
      entityType: "evidence",
      schemaVersion: "${VERSION_AXES.schemaVersion}",
      title: record.title,
      createdAt: record.createdAt || timestamp,
      updatedAt: timestamp,
      sourceProduct: "explorer",
      recordStatus: "active",
      evidenceType: record.evidenceType || "document",
      reference: record.reference,
      freshness: record.freshness || "unknown"
    },
    link: {
      id: record.linkId,
      entityType: "link",
      schemaVersion: "${VERSION_AXES.schemaVersion}",
      title: "Local evidence supports requirement",
      createdAt: record.createdAt || timestamp,
      updatedAt: timestamp,
      sourceProduct: "explorer",
      recordStatus: "active",
      linkType: "supported-by",
      fromId: record.requirementId,
      fromType: "requirement",
      toId: record.evidenceId,
      toType: "evidence"
    }
  };
}

async function exportLocalAuthoringBundle() {
  const collections = cloneCollections(currentCollections || {});
  const manifestCollections = [];
  for (const collectionName of ["domains", "requirements", "evidence", "actions", "risks", "snapshots", "links", "tags", "source-controls", "requirement-control-mappings", "directions", "posture"]) {
    const records = collections[collectionName] || [];
    const serialised = JSON.stringify(records, null, 2) + "\\n";
    manifestCollections.push({
      name: collectionName,
      path: "./collections/" + collectionName + ".json",
      count: records.length,
      hash: { alg: "SHA-256", value: await sha256(serialised) }
    });
  }
  return {
    manifest: {
      $schema: "./schemas/manifest.schema.json",
      bundleType: "pspf-explorer-bundle",
      bundleVersion: "${VERSION_AXES.bundleVersion}",
      schemaVersion: "${VERSION_AXES.schemaVersion}",
      apiVersion: "${VERSION_AXES.apiVersion}",
      generatedAt: new Date().toISOString(),
      generator: {
        product: "pspf-explorer",
        mode: "local-authoring",
        productVersion: "${PSPF_SLICE_VERSION}",
        workspaceId: currentManifest?.generator?.workspaceId || currentBundleKey
      },
      compatibility: {
        explorerMin: "${PSPF_SLICE_VERSION}",
        explorerTested: "${PSPF_SLICE_VERSION}"
      },
      security: currentManifest?.security || {
        classification: "OFFICIAL: Sensitive",
        containsSensitiveData: true,
        redactionProfile: "explorer-default"
      },
      collections: manifestCollections,
      indexes: []
    },
    collections
  };
}

function downloadJson(fileName, value) {
  const blob = new Blob([JSON.stringify(value, null, 2) + "\\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function updateStorageStatus() {
  const target = document.querySelector("#local-storage-status");
  if (!target) {
    return;
  }
  if (!navigator.storage?.estimate) {
    target.textContent = "IndexedDB ready.";
    return;
  }
  const estimate = await navigator.storage.estimate();
  const used = estimate.usage || 0;
  const quota = estimate.quota || 0;
  target.textContent = quota > 0 ? "IndexedDB " + formatBytes(used) + " used of " + formatBytes(quota) : "IndexedDB ready.";
}

function formatBytes(value) {
  if (value < 1024) {
    return value + " B";
  }
  if (value < 1024 * 1024) {
    return Math.round(value / 1024) + " KB";
  }
  return Math.round(value / (1024 * 1024)) + " MB";
}

function bundleStorageKey(manifest) {
  const stableParts = [manifest?.generator?.workspaceId, manifest?.generator?.snapshotId, manifest?.schemaVersion].filter(Boolean);
  if (stableParts.length > 0) {
    return stableParts.join("::");
  }
  return [manifest?.generatedAt, manifest?.schemaVersion].filter(Boolean).join("::") || "default";
}

function cloneCollections(collections) {
  return JSON.parse(JSON.stringify(collections || {}));
}

function openLocalDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(localDbName, 4);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(localStoreName)) {
        const store = db.createObjectStore(localStoreName, { keyPath: "key" });
        store.createIndex("bundleKey", "bundleKey", { unique: false });
      }
      if (!db.objectStoreNames.contains(localEvidenceStoreName)) {
        const store = db.createObjectStore(localEvidenceStoreName, { keyPath: "key" });
        store.createIndex("bundleKey", "bundleKey", { unique: false });
      }
      if (!db.objectStoreNames.contains(localActionStoreName)) {
        const store = db.createObjectStore(localActionStoreName, { keyPath: "key" });
        store.createIndex("bundleKey", "bundleKey", { unique: false });
      }
      if (!db.objectStoreNames.contains(localRiskStoreName)) {
        const store = db.createObjectStore(localRiskStoreName, { keyPath: "key" });
        store.createIndex("bundleKey", "bundleKey", { unique: false });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function loadLocalRisks(bundleKey) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(localRiskStoreName, "readonly");
    const store = transaction.objectStore(localRiskStoreName);
    const index = store.index("bundleKey");
    const request = index.getAll(bundleKey);
    request.addEventListener("success", () => resolve(request.result.sort((left, right) => left.createdAt.localeCompare(right.createdAt))));
    request.addEventListener("error", () => reject(request.error));
    transaction.addEventListener("complete", () => db.close());
  });
}

async function saveLocalRisk(record) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(localRiskStoreName, "readwrite");
    transaction.objectStore(localRiskStoreName).put(record);
    transaction.addEventListener("complete", () => { db.close(); resolve(); });
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

async function loadLocalActions(bundleKey) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(localActionStoreName, "readonly");
    const store = transaction.objectStore(localActionStoreName);
    const index = store.index("bundleKey");
    const request = index.getAll(bundleKey);
    request.addEventListener("success", () => resolve(request.result.sort((left, right) => left.createdAt.localeCompare(right.createdAt))));
    request.addEventListener("error", () => reject(request.error));
    transaction.addEventListener("complete", () => db.close());
  });
}

async function saveLocalAction(record) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(localActionStoreName, "readwrite");
    transaction.objectStore(localActionStoreName).put(record);
    transaction.addEventListener("complete", () => { db.close(); resolve(); });
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

async function loadLocalEvidenceReferences(bundleKey) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(localEvidenceStoreName, "readonly");
    const store = transaction.objectStore(localEvidenceStoreName);
    const index = store.index("bundleKey");
    const request = index.getAll(bundleKey);
    request.addEventListener("success", () => resolve(request.result.sort((left, right) => left.createdAt.localeCompare(right.createdAt))));
    request.addEventListener("error", () => reject(request.error));
    transaction.addEventListener("complete", () => db.close());
  });
}

async function saveLocalEvidenceReference(record) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(localEvidenceStoreName, "readwrite");
    transaction.objectStore(localEvidenceStoreName).put(record);
    transaction.addEventListener("complete", () => { db.close(); resolve(); });
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

async function loadLocalRequirementStatuses(bundleKey) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(localStoreName, "readonly");
    const store = transaction.objectStore(localStoreName);
    const index = store.index("bundleKey");
    const request = index.getAll(bundleKey);
    request.addEventListener("success", () => resolve(new Map(request.result.map((item) => [item.requirementId, item]))));
    request.addEventListener("error", () => reject(request.error));
    transaction.addEventListener("complete", () => db.close());
  });
}

async function saveLocalRequirementStatus(record) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(localStoreName, "readwrite");
    transaction.objectStore(localStoreName).put(record);
    transaction.addEventListener("complete", () => { db.close(); resolve(); });
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

async function deleteLocalRequirementStatus(bundleKey, requirementId) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(localStoreName, "readwrite");
    transaction.objectStore(localStoreName).delete(bundleKey + "::" + requirementId);
    transaction.addEventListener("complete", () => { db.close(); resolve(); });
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

async function resetLocalRequirementStatuses(bundleKey) {
  await resetObjectStoreByBundleKey(localStoreName, bundleKey);
}

async function resetLocalEvidenceReferences(bundleKey) {
  await resetObjectStoreByBundleKey(localEvidenceStoreName, bundleKey);
}

async function resetLocalData(bundleKey) {
  await resetLocalRequirementStatuses(bundleKey);
  await resetLocalEvidenceReferences(bundleKey);
  await resetLocalActions(bundleKey);
  await resetLocalRisks(bundleKey);
}

async function resetLocalActions(bundleKey) {
  await resetObjectStoreByBundleKey(localActionStoreName, bundleKey);
}

async function resetLocalRisks(bundleKey) {
  await resetObjectStoreByBundleKey(localRiskStoreName, bundleKey);
}

async function resetObjectStoreByBundleKey(storeName, bundleKey) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const targetStore = transaction.objectStore(storeName);
    const index = targetStore.index("bundleKey");
    const request = index.getAllKeys(bundleKey);
    request.addEventListener("success", () => {
      for (const key of request.result) {
        targetStore.delete(key);
      }
    });
    transaction.addEventListener("complete", () => { db.close(); resolve(); });
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

function validationTable(checks) {
  const rows = checks.map((item) => '<tr><td>' + escapeHtml(item.label) + '</td><td><span class="check ' + (item.ok ? "pass" : "fail") + '" aria-label="' + escapeHtml(item.ok ? "Pass" : "Fail") + '">' + (item.ok ? "PASS" : "FAIL") + '</span></td><td>' + escapeHtml(item.detail) + '</td></tr>').join("");
  return '<div class="table-wrap" tabindex="0" aria-label="Scrollable bundle validation table"><table class="validation-table"><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function check(label, ok, detail) {
  return { label, ok: Boolean(ok), detail: String(detail || "") };
}

function metric(label, value) {
  return '<div class="metric"><span>' + escapeHtml(label) + '</span><strong>' + value + '</strong></div>';
}

function summariseRelationships(links) {
  const evidenceByRequirement = new Map();
  const actionsByRequirement = new Map();
  const risksByRequirement = new Map();
  const requirementsByEvidence = new Map();
  const requirementsByAction = new Map();
  const requirementsByRisk = new Map();
  for (const link of links) {
    if (link.fromType !== "requirement") {
      continue;
    }
    if (link.linkType === "supported-by" && link.toType === "evidence") {
      increment(evidenceByRequirement, link.fromId);
      append(requirementsByEvidence, link.toId, link.fromId);
    }
    if (link.linkType === "addressed-by" && link.toType === "action") {
      increment(actionsByRequirement, link.fromId);
      append(requirementsByAction, link.toId, link.fromId);
    }
    if (link.linkType === "exposed-by" && link.toType === "risk") {
      increment(risksByRequirement, link.fromId);
      append(requirementsByRisk, link.toId, link.fromId);
    }
  }
  return { evidenceByRequirement, actionsByRequirement, risksByRequirement, requirementsByEvidence, requirementsByAction, requirementsByRisk };
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function append(map, key, value) {
  map.set(key, [...(map.get(key) || []), value]);
}

function titleList(ids, requirementsById) {
  const titles = (ids || []).map((id) => requirementsById.get(id)?.title || id);
  return titles.length > 0 ? titles.join("; ") : "None linked";
}

function actionImpactTable(collections) {
  const actions = (collections.actions || []).filter((action) => action.impact);
  if (actions.length === 0) {
    return '<p class="muted">No Action Impact scores published in this bundle. Add at least one Action linked to a requirement, evidence gap, risk, or Direction.</p>';
  }
  const rows = actions.map((action) => {
    const impact = action.impact || {};
    const total = (impact.postureUplift || 0) + (impact.evidenceUplift || 0) + (impact.riskReduction || 0) + (impact.directionUplift || 0);
    return {
      title: action.title,
      total,
      postureUplift: impact.postureUplift || 0,
      evidenceUplift: impact.evidenceUplift || 0,
      riskReduction: impact.riskReduction || 0,
      directionUplift: impact.directionUplift || 0,
      urgency: label(impact.urgency || "normal"),
      explanation: (impact.explanation || []).join("; ")
    };
  }).sort((left, right) => right.total - left.total).slice(0, 10);
  return table(rows, ["title", "total", "postureUplift", "evidenceUplift", "riskReduction", "directionUplift", "urgency", "explanation"]);
}

function entityTitleMap(collections) {
  const entitiesById = new Map();
  for (const collectionName of ["domains", "requirements", "evidence", "actions", "risks", "snapshots", "links", "tags", "source-controls", "requirement-control-mappings", "directions", "posture"]) {
    for (const entity of collections[collectionName] || []) {
      entitiesById.set(entity.id, entity.title || label(entity.entityType));
    }
  }
  return entitiesById;
}

function overview(requirements, collections) {
  const counts = statusCounts(requirements);
  const total = requirements.length;
  const met = counts.met;
  const partial = counts["partially-met"] + counts["in-progress"] + counts["under-review"];
  const notMet = counts["not-met"];
  const remaining = Math.max(total - met, 0);
  const metEnd = percent(met, total);
  const partialEnd = percent(met + partial, total);
  const notMetEnd = percent(met + partial + notMet, total);
  const statusTable = '<h3 class="visually-hidden">Compliance status table alternative</h3>' +
    table([
      { status: "Met", count: met },
      { status: "In progress, partial, or under review", count: partial },
      { status: "Not met", count: notMet },
      { status: "Other", count: Math.max(total - met - partial - notMet, 0) }
    ], ["status", "count"]);
  return '<div class="overview-grid" aria-label="Posture overview">' +
    '<div class="panel-lite">' +
      '<h3>Compliance Status</h3>' +
      '<div class="donut-wrap">' +
        '<div class="donut" role="img" aria-label="' + escapeHtml(metEnd + '% of requirements are met. ' + remaining + ' remaining.') + '" style="--met: ' + metEnd + '%; --partial: ' + partialEnd + '%; --not-met: ' + notMetEnd + '%;">' +
          '<div class="donut-centre"><span><strong>' + metEnd + '%</strong>met</span></div>' +
        '</div>' +
        '<div class="legend" aria-hidden="true">' +
          '<span style="--swatch: #22c55e;">Met: ' + met + '</span>' +
          '<span style="--swatch: #f59e0b;">In progress/partial/review: ' + partial + '</span>' +
          '<span style="--swatch: #f87171;">Not met: ' + notMet + '</span>' +
          '<span style="--swatch: #71717a;">Other: ' + Math.max(total - met - partial - notMet, 0) + '</span>' +
        '</div>' +
      '</div>' +
      statusTable +
    '</div>' +
    '<div>' +
      '<h3>Domain Posture</h3>' + domainBars(requirements) +
      '<h3>Needs Attention</h3>' + attentionList(requirements, collections) +
    '</div>' +
  '</div>';
}

function statusCounts(requirements) {
  const counts = { "not-started": 0, "in-progress": 0, met: 0, "partially-met": 0, "not-met": 0, "not-applicable": 0, "under-review": 0 };
  for (const requirement of requirements) {
    counts[requirement.assessmentStatus] = (counts[requirement.assessmentStatus] || 0) + 1;
  }
  return counts;
}

function domainBars(requirements) {
  const byDomain = new Map();
  for (const requirement of requirements) {
    const item = byDomain.get(requirement.domain) || { domain: requirement.domain, total: 0, met: 0 };
    item.total += 1;
    item.met += requirement.assessmentStatus === "met" ? 1 : 0;
    byDomain.set(requirement.domain, item);
  }
  if (byDomain.size === 0) {
    return '<p class="muted">No domain posture data yet.</p>';
  }
  const rows = Array.from(byDomain.values()).sort((left, right) => left.domain.localeCompare(right.domain));
  return '<div class="bar-list">' + rows.map((row) => {
    const value = percent(row.met, row.total);
    return '<div class="bar-row"><span>' + escapeHtml(row.domain) + '</span><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="--value: ' + value + '%;"></div></div><strong>' + value + '%</strong></div>';
  }).join("") + '</div>' + table(rows.map((row) => ({ domain: row.domain, requirements: row.total, met: row.met, metPercentage: percent(row.met, row.total) + "%" })), ["domain", "requirements", "met", "metPercentage"]);
}

function attentionList(requirements, collections) {
  const links = collections.links || [];
  const evidenceIdsByRequirement = new Map();
  for (const link of links) {
    if (link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence") {
      evidenceIdsByRequirement.set(link.fromId, [...(evidenceIdsByRequirement.get(link.fromId) || []), link.toId]);
    }
  }
  const evidenceById = new Map((collections.evidence || []).map((item) => [item.id, item]));
  const rows = requirements.filter((requirement) => {
    const evidenceIds = evidenceIdsByRequirement.get(requirement.id) || [];
    const hasCurrentEvidence = evidenceIds.some((id) => evidenceById.get(id) && evidenceById.get(id).freshness === "current");
    return requirement.assessmentStatus !== "met" || !hasCurrentEvidence;
  }).slice(0, 8).map((requirement) => {
    const evidenceIds = evidenceIdsByRequirement.get(requirement.id) || [];
    const hasCurrentEvidence = evidenceIds.some((id) => evidenceById.get(id) && evidenceById.get(id).freshness === "current");
    return {
      title: requirement.title,
      domain: requirement.domain,
      status: label(requirement.assessmentStatus),
      evidence: hasCurrentEvidence ? "Current" : evidenceIds.length > 0 ? "Review freshness" : "Missing"
    };
  });
  return table(rows, ["title", "domain", "status", "evidence"]);
}

function percent(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function table(rows, keys) {
  if (rows.length === 0) {
    return '<p class="muted">No records in this collection yet.</p>';
  }
  return tableHtml(rows, keys);
}

function tableHtml(rows, keys) {
  const header = keys.map((key) => '<th data-field="' + escapeHtml(key) + '">' + escapeHtml(label(key)) + '</th>').join("");
  const body = rows.map((row) => '<tr>' + keys.map((key) => '<td data-field="' + escapeHtml(key) + '">' + tableValue(row[key], key) + '</td>').join("") + '</tr>').join("");
  return '<div class="table-wrap" tabindex="0" aria-label="Scrollable data table"><table><thead><tr>' + header + '</tr></thead><tbody>' + body + '</tbody></table></div>';
}

function tableValue(value, key) {
  if (value === undefined || value === null || value === "") {
    return '<span class="empty-value">Not recorded</span>';
  }
  if (key === "local" || key === "source") {
    return String(value);
  }
  if (value === 0) {
    return '<span class="empty-value">None</span>';
  }
  return escapeHtml(String(value));
}

function label(value) {
  return String(value).replace(/-/g, " ").replace(/[A-Z]/g, (letter) => " " + letter.toLowerCase()).replace(/^./, (letter) => letter.toUpperCase());
}

function compactEntityId(value) {
  const id = String(value || "");
  const match = id.match(/^([A-Z]+)-.*?([0-9A-Fa-f]{4})$/);
  return match ? match[1] + "-" + match[2].toUpperCase() : id;
}

function formatShortDate(value) {
  if (!value) {
    return undefined;
  }
  const text = String(value).trim();
  const isoMatch = text.match(/^(\\d{4})-(\\d{2})-(\\d{2})(?:T00:00:00(?:\\.000)?Z?)?$/);
  if (isoMatch) {
    return formatDateParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }
  const auMatch = text.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);
  if (auMatch) {
    return formatDateParts(Number(auMatch[3]), Number(auMatch[2]), Number(auMatch[1]));
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function formatDateParts(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return day + " " + months[month - 1] + " " + year;
}

function driftStatusLabel(status) {
  switch (status) {
    case "changed":
      return "Review current";
    case "new":
      return "New control";
    case "removed":
      return "Removed upstream";
    case "unchanged":
    default:
      return "Current";
  }
}

function readJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(JSON.parse(String(reader.result))));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

function readText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function containsPath(value, pathParts) {
  if (pathParts.length === 0) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsPath(item, pathParts));
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  const head = pathParts[0];
  const tail = pathParts.slice(1);
  if (Object.prototype.hasOwnProperty.call(value, head) && containsPath(value[head], tail)) {
    return true;
  }
  return Object.values(value).some((item) => containsPath(item, pathParts));
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "unknown";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

globalThis.pspfExplorerRender = render;
globalThis.pspfExplorerCurrentBrief = () => currentBriefInput && globalThis.pspfBriefRenderer ? globalThis.pspfBriefRenderer.renderPostureBriefMarkdown(currentBriefInput) : undefined;
globalThis.pspfExplorerSetLocalRequirementStatus = setLocalRequirementStatus;
globalThis.pspfExplorerAddLocalEvidenceReference = addLocalEvidenceReference;
globalThis.pspfExplorerAddLocalAction = addLocalAction;
globalThis.pspfExplorerAddLocalRisk = addLocalRisk;
globalThis.pspfExplorerExportLocalBundle = exportLocalAuthoringBundle;
globalThis.pspfExplorerResetLocalData = () => resetLocalData(currentBundleKey);
`;

await writeFile(join(dist, "index.html"), html, "utf8");
await writeFile(join(dist, "brief-renderer.js"), `${POSTURE_BRIEF_BROWSER_SCRIPT}\n`, "utf8");
await writeFile(join(dist, "app.js"), app, "utf8");
console.log(`Built ${join(dist, "index.html")}`);
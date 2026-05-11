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
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    button, input { font: inherit; }
    button { background: #0f766e; color: #f0fdfa; border: 1px solid #14b8a6; border-radius: 6px; padding: 8px 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    button:hover { background: #0d9488; }
    button:focus-visible { outline: 3px solid #38bdf8; outline-offset: 2px; }
    input { color: #f4f4f5; }
    input::file-selector-button { background: #27272a; color: #f4f4f5; border: 1px solid #52525b; border-radius: 6px; padding: 6px 10px; }
    input:focus-visible { outline: 3px solid #38bdf8; outline-offset: 2px; }
    a { color: #bae6fd; }
    a:focus-visible { outline: 3px solid #38bdf8; outline-offset: 2px; border-radius: 4px; }
    .banner { background: #3f2f11; border-bottom: 1px solid #d97706; color: #fde68a; padding: 8px 20px; font-weight: 600; }
    .panel { background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
    .section-nav { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: rgba(17, 17, 19, 0.92); border: 1px solid #3f3f46; border-radius: 6px; padding: 8px; margin: 0 0 16px; backdrop-filter: blur(10px); }
    .section-nav a { color: #e4e4e7; text-decoration: none; border: 1px solid #3f3f46; background: #202024; border-radius: 6px; padding: 6px 10px; font-size: 14px; white-space: nowrap; }
    .section-nav a:hover { border-color: #38bdf8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .metric { border: 1px solid #3f3f46; border-radius: 6px; padding: 12px; background: #202024; }
    .metric strong { display: block; font-size: 28px; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 12px 0; }
    .version-strip { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
    .version-pill { border: 1px solid #3f3f46; border-radius: 999px; padding: 3px 8px; color: #d4d4d8; background: #202024; font-size: 12px; line-height: 1.4; white-space: nowrap; }
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
    th[data-field="title"], td[data-field="title"], th[data-field="requirement"], td[data-field="requirement"], th[data-field="control"], td[data-field="control"], th[data-field="target"], td[data-field="target"] { min-width: 18rem; max-width: 34rem; }
    th[data-field="controlId"], td[data-field="controlId"], th[data-field="coverage"], td[data-field="coverage"], th[data-field="profile"], td[data-field="profile"], th[data-field="confidence"], td[data-field="confidence"], th[data-field="reviewed"], td[data-field="reviewed"], th[data-field="drift"], td[data-field="drift"], th[data-field="release"], td[data-field="release"], th[data-field="status"], td[data-field="status"] { white-space: nowrap; width: 1%; }
    .validation-table th:nth-child(2), .validation-table td:nth-child(2) { width: 1%; white-space: nowrap; }
    .empty-value { color: #a1a1aa; font-style: italic; }
    code { color: #bae6fd; }
    .muted { color: #a1a1aa; }
    .footer { color: #a1a1aa; font-size: 13px; margin-top: 24px; }
    section { scroll-margin-top: 76px; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    @media (max-width: 720px) { .overview-grid, .bar-row { grid-template-columns: 1fr; } main { padding: 16px; } table { min-width: 680px; } th[data-field="title"], td[data-field="title"], th[data-field="requirement"], td[data-field="requirement"], th[data-field="control"], td[data-field="control"] { min-width: 16rem; } }
  </style>
</head>
<body>
  <header role="banner"><strong>PSPF Explorer</strong><span>Publication mode · v${PSPF_SLICE_VERSION}</span></header>
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
      <a href="#requirements">Requirements</a>
      <a href="#evidence">Evidence</a>
      <a href="#actions">Actions</a>
      <a href="#risks">Risks</a>
      <a href="#source-controls">ISM Source Controls</a>
      <a href="#ism-coverage">ISM Coverage</a>
      <a href="#links">Relationships</a>
    </nav>
    <section id="summary" class="panel" aria-live="polite" hidden></section>
    <section id="validation" class="panel" aria-live="polite" hidden></section>
    <section id="requirements" class="panel" hidden></section>
    <section id="evidence" class="panel" hidden></section>
    <section id="actions" class="panel" hidden></section>
    <section id="risks" class="panel" hidden></section>
    <section id="source-controls" class="panel" hidden></section>
    <section id="ism-coverage" class="panel" hidden></section>
    <section id="links" class="panel" hidden></section>
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
const requirementsSection = document.querySelector("#requirements");
const evidenceSection = document.querySelector("#evidence");
const actionsSection = document.querySelector("#actions");
const risksSection = document.querySelector("#risks");
const sourceControlsSection = document.querySelector("#source-controls");
const ismCoverageSection = document.querySelector("#ism-coverage");
const linksSection = document.querySelector("#links");
let currentBriefInput;

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

async function render(manifest, collections, collectionTexts = undefined) {
  const posture = collections.posture && collections.posture[0] ? collections.posture[0] : {};
  const validation = await validateBundle(manifest, collections, collectionTexts);
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
    risks: relationshipSummary.risksByRequirement.get(requirement.id) || 0
  }));
  const evidence = (collections.evidence || []).map((item) => ({
    ...item,
    requirements: titleList(relationshipSummary.requirementsByEvidence.get(item.id), requirementsById)
  }));
  const actions = (collections.actions || []).map((item) => ({
    ...item,
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
      requirement: requirement ? requirement.title : mapping.requirementId,
      controlId: sourceControl ? sourceControl.controlId : mapping.sourceControlId,
      control: sourceControl ? sourceControl.title : "Unknown source control",
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
      metric("ISM controls", (collections["source-controls"] || []).length) +
      metric("ISM mappings", (collections["requirement-control-mappings"] || []).length) +
    '</div>' +
    overview(requirements, collections) +
    '<p class="muted">Bundle ' + escapeHtml(manifest.bundleVersion) + " · Schema " + escapeHtml(manifest.schemaVersion) + " · Generated " + formatDate(manifest.generatedAt) + '</p>';
  document.querySelector("#copy-brief")?.addEventListener("click", copyPostureBrief);

  validationSection.hidden = false;
  validationSection.innerHTML = '<h2>Bundle Validation</h2>' + validationTable(validation);

  requirementsSection.hidden = false;
  requirementsSection.innerHTML = '<h2>Requirements</h2>' + table(requirements, ["title", "assessmentStatus", "domain", "evidence", "actions", "risks"]);

  evidenceSection.hidden = false;
  evidenceSection.innerHTML = '<h2>Evidence</h2>' + table(evidence, ["title", "evidenceType", "freshness", "requirements", "reference"]);

  actionsSection.hidden = false;
  actionsSection.innerHTML = '<h2>Actions</h2>' + table(actions, ["title", "status", "dueDate", "requirements"]);

  risksSection.hidden = false;
  risksSection.innerHTML = '<h2>Risks</h2>' + table(risks, ["title", "status", "likelihood", "impact", "requirements"]);

  sourceControlsSection.hidden = false;
  sourceControlsSection.innerHTML = '<h2>ISM Source Controls</h2><p class="muted">ISM source: cyber.gov.au · ASD/ACSC · CC BY 4.0.</p>' + table(sourceControls, ["controlId", "title", "profiles", "release", "drift"]);

  ismCoverageSection.hidden = false;
  ismCoverageSection.innerHTML = '<h2>ISM Coverage</h2>' + table(ismCoverage, ["requirement", "controlId", "control", "coverage", "profile", "confidence", "reviewed", "reviewer", "drift", "release"]);

  linksSection.hidden = false;
  linksSection.innerHTML = '<h2>Relationships Board</h2>' + table(relationships, ["title", "relationship", "from", "to"]);
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
  const expectedCollections = ["domains", "requirements", "evidence", "actions", "risks", "snapshots", "links", "tags", "source-controls", "requirement-control-mappings", "posture"];
  const checks = [
    check("Bundle version", manifest.bundleVersion === "${VERSION_AXES.bundleVersion}", manifest.bundleVersion || "missing"),
    check("Schema version", manifest.schemaVersion === "${VERSION_AXES.schemaVersion}", manifest.schemaVersion || "missing"),
    check("API version", manifest.apiVersion === "${VERSION_AXES.apiVersion}", manifest.apiVersion || "missing"),
    check("Publication mode", manifest.generator && manifest.generator.mode === "publication", manifest.generator && manifest.generator.mode || "missing"),
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

function entityTitleMap(collections) {
  const entitiesById = new Map();
  for (const collectionName of ["domains", "requirements", "evidence", "actions", "risks", "snapshots", "links", "tags", "source-controls", "requirement-control-mappings", "posture"]) {
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
    '</div>' +
    '<div>' +
      '<h3>Domain Posture</h3>' + domainBars(requirements) +
      '<h3>Needs Attention</h3>' + attentionList(requirements, collections) +
    '</div>' +
  '</div>' +
  '<h3 class="visually-hidden">Compliance status table alternative</h3>' +
  table([
    { status: "Met", count: met },
    { status: "In progress, partial, or under review", count: partial },
    { status: "Not met", count: notMet },
    { status: "Other", count: Math.max(total - met - partial - notMet, 0) }
  ], ["status", "count"]);
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
  const header = keys.map((key) => '<th data-field="' + escapeHtml(key) + '">' + escapeHtml(label(key)) + '</th>').join("");
  const body = rows.map((row) => '<tr>' + keys.map((key) => '<td data-field="' + escapeHtml(key) + '">' + tableValue(row[key]) + '</td>').join("") + '</tr>').join("");
  return '<div class="table-wrap" tabindex="0" aria-label="Scrollable data table"><table><thead><tr>' + header + '</tr></thead><tbody>' + body + '</tbody></table></div>';
}

function tableValue(value) {
  if (value === undefined || value === null || value === "") {
    return '<span class="empty-value">Not recorded</span>';
  }
  if (value === 0) {
    return '<span class="empty-value">None</span>';
  }
  return escapeHtml(String(value));
}

function label(value) {
  return String(value).replace(/-/g, " ").replace(/[A-Z]/g, (letter) => " " + letter.toLowerCase()).replace(/^./, (letter) => letter.toUpperCase());
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
`;

await writeFile(join(dist, "index.html"), html, "utf8");
await writeFile(join(dist, "brief-renderer.js"), `${POSTURE_BRIEF_BROWSER_SCRIPT}\n`, "utf8");
await writeFile(join(dist, "app.js"), app, "utf8");
console.log(`Built ${join(dist, "index.html")}`);
import * as vscode from "vscode";
import { renderPostureBriefMarkdown } from "@pspf/brief-renderer";
import {
  PSPF_SLICE_VERSION,
  PSPF_DOMAINS,
  VERSION_AXES,
  type ActionEntity,
  type ActionStatus,
  type AssessmentStatus,
  type EvidenceEntity,
  type EvidenceFreshness,
  type LinkEntity,
  type MappingConfidence,
  type RequirementEntity,
  type RequirementControlMappingEntity,
  type RiskEntity,
  type RiskStatus,
  type SourceControlEntity,
  type V01Entity,
  withEnvelope
} from "@pspf/contracts";

const recentRequirementKey = "pspf.workshop.recentRequirementId";
let workshopContext: vscode.ExtensionContext | undefined;

export function activate(context: vscode.ExtensionContext): void {
  workshopContext = context;
  context.subscriptions.push(
    vscode.commands.registerCommand("pspf.workshop.createRequirement", createRequirement),
    vscode.commands.registerCommand("pspf.workshop.attachEvidence", attachEvidence),
    vscode.commands.registerCommand("pspf.workshop.createAction", createAction),
    vscode.commands.registerCommand("pspf.workshop.createRisk", createRisk),
    vscode.commands.registerCommand("pspf.workshop.openAssessmentDashboard", openAssessmentDashboard),
    vscode.commands.registerCommand("pspf.workshop.openEvidenceReviewQueue", openEvidenceReviewQueue),
    vscode.commands.registerCommand("pspf.workshop.openItemDetail", openItemDetail),
    vscode.commands.registerCommand("pspf.workshop.browseIsmSourceControls", browseIsmSourceControls),
    vscode.commands.registerCommand("pspf.workshop.createRequirementControlMapping", createRequirementControlMapping),
    vscode.commands.registerCommand("pspf.workshop.copyPostureBrief", copyPostureBrief)
  );
}

export function deactivate(): void {
  // No runtime resources to dispose yet.
}

async function createRequirement(): Promise<void> {
  await ensureCoreReady();
  const title = await vscode.window.showInputBox({
    title: "Create Requirement",
    prompt: "Requirement title",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter a requirement title." : undefined
  });
  if (!title) {
    return;
  }

  const domain = await vscode.window.showQuickPick(
    PSPF_DOMAINS.map((item) => ({ label: item.title, description: item.code, domainId: item.id })),
    { title: "Select PSPF Domain", ignoreFocusOut: true }
  );
  if (!domain) {
    return;
  }

  const assessmentStatus = await vscode.window.showQuickPick(
    assessmentStatusItems,
    { title: "Select Assessment Status", ignoreFocusOut: true }
  );
  if (!assessmentStatus) {
    return;
  }

  const summary = await vscode.window.showInputBox({
    title: "Create Requirement",
    prompt: "Internal summary, not published by default",
    ignoreFocusOut: true
  });

  const requirement = withEnvelope(
    "requirement",
    {
      entityType: "requirement",
      title: title.trim(),
      domainId: domain.domainId,
      assessmentStatus: assessmentStatus.value,
      summary: summary?.trim() || undefined
    },
    "workshop"
  );

  await vscode.commands.executeCommand("pspf.core.upsertEntity", requirement);
  await rememberRequirement(requirement);
  const action = await vscode.window.showInformationMessage(`Requirement created: ${requirement.title}`, "Open Item Detail");
  if (action === "Open Item Detail") {
    await openItemDetailForRequirement(requirement);
  }
}

async function attachEvidence(): Promise<void> {
  await ensureCoreReady();
  const requirement = await pickRequirement();
  if (!requirement) {
    return;
  }

  const title = await vscode.window.showInputBox({
    title: "Attach Evidence",
    prompt: "Evidence title",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter an evidence title." : undefined
  });
  if (!title) {
    return;
  }

  const evidenceType = await vscode.window.showQuickPick(
    evidenceTypeItems,
    { title: "Select Evidence Type", ignoreFocusOut: true }
  );
  if (!evidenceType) {
    return;
  }

  const reference = await vscode.window.showInputBox({
    title: "Attach Evidence",
    prompt: "File path, URL, or short reference",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter an evidence reference." : undefined
  });
  if (!reference) {
    return;
  }

  const freshness = await vscode.window.showQuickPick(
    freshnessItems,
    { title: "Select Evidence Freshness", ignoreFocusOut: true }
  );
  if (!freshness) {
    return;
  }

  const evidence = withEnvelope(
    "evidence",
    {
      entityType: "evidence",
      title: title.trim(),
      evidenceType: evidenceType.value,
      reference: reference.trim(),
      freshness: freshness.value
    },
    "workshop"
  );
  const link = withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${requirement.title} supported by ${evidence.title}`,
      linkType: "supported-by",
      fromId: requirement.id,
      fromType: "requirement",
      toId: evidence.id,
      toType: "evidence"
    },
    "workshop"
  );

  await upsertLinkedEntity(evidence, link, requirement);
}

async function createAction(): Promise<void> {
  await ensureCoreReady();
  const requirement = await pickRequirement();
  if (!requirement) {
    return;
  }

  const title = await vscode.window.showInputBox({
    title: "Create Action",
    prompt: "Action title",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter an action title." : undefined
  });
  if (!title) {
    return;
  }

  const status = await vscode.window.showQuickPick(
    actionStatusItems,
    { title: "Select Action Status", ignoreFocusOut: true }
  );
  if (!status) {
    return;
  }

  const dueDate = await vscode.window.showInputBox({
    title: "Create Action",
    prompt: "Due date, for example 30 Jun 2026. Press Enter to skip.",
    ignoreFocusOut: true
  });
  if (dueDate === undefined) {
    return;
  }

  const action = withEnvelope(
    "action",
    {
      entityType: "action",
      title: title.trim(),
      status: status.value,
      dueDate: dueDate?.trim() || undefined
    },
    "workshop"
  );
  const link = withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${requirement.title} addressed by ${action.title}`,
      linkType: "addressed-by",
      fromId: requirement.id,
      fromType: "requirement",
      toId: action.id,
      toType: "action"
    },
    "workshop"
  );

  await upsertLinkedEntity(action, link, requirement);
}

async function createRisk(): Promise<void> {
  await ensureCoreReady();
  const requirement = await pickRequirement();
  if (!requirement) {
    return;
  }

  const title = await vscode.window.showInputBox({
    title: "Create Risk",
    prompt: "Risk title",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Enter a risk title." : undefined
  });
  if (!title) {
    return;
  }

  const status = await vscode.window.showQuickPick(
    riskStatusItems,
    { title: "Select Risk Status", ignoreFocusOut: true }
  );
  if (!status) {
    return;
  }

  const likelihood = await pickScore("Select Likelihood");
  if (!likelihood) {
    return;
  }

  const impact = await pickScore("Select Impact");
  if (!impact) {
    return;
  }

  const risk = withEnvelope(
    "risk",
    {
      entityType: "risk",
      title: title.trim(),
      status: status.value,
      likelihood,
      impact
    },
    "workshop"
  );
  const link = withEnvelope(
    "link",
    {
      entityType: "link",
      title: `${requirement.title} exposed by ${risk.title}`,
      linkType: "exposed-by",
      fromId: requirement.id,
      fromType: "requirement",
      toId: risk.id,
      toType: "risk"
    },
    "workshop"
  );

  await upsertLinkedEntity(risk, link, requirement);
}

async function upsertLinkedEntity(entity: V01Entity, link: LinkEntity, requirement: RequirementEntity): Promise<void> {
  await vscode.commands.executeCommand("pspf.core.upsertEntities", [entity, link]);
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities");
  const allEntities = entities ?? [];
  const entityExists = allEntities.some((candidate) => candidate.id === entity.id);
  const linkExists = allEntities.some((candidate) => candidate.id === link.id && candidate.entityType === "link");
  if (!entityExists || !linkExists) {
    throw new Error(`Could not confirm ${label(entity.entityType)} was linked. Run PSPF: Validate Workspace and try again.`);
  }
  await rememberRequirement(requirement);
  const entityTitle = entity.title ?? entity.id;
  const message = `${label(entity.entityType)} linked to ${requirement.title}: ${entityTitle} (${label(link.linkType)})`;
  const action = await vscode.window.showInformationMessage(message, "Open Item Detail");
  if (action === "Open Item Detail") {
    await openItemDetailForRequirement(requirement);
  }
}

async function openAssessmentDashboard(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence");
  const actions = allEntities.filter((entity): entity is ActionEntity => entity.entityType === "action");
  const risks = allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");
  const evidenceRequirementIds = new Set(links.filter((link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence").map((link) => link.fromId));
  const validationHints = buildValidationHints(requirements, actions, risks, links);
  const recentRequirementId = getRecentRequirementId();
  const recentRequirement = recentRequirementId ? requirements.find((requirement) => requirement.id === recentRequirementId) : undefined;
  const openActionCount = actions.filter((action) => !["done", "cancelled"].includes(action.status)).length;
  const openRiskCount = risks.filter((risk) => risk.status !== "closed").length;
  const domainRows = PSPF_DOMAINS.map((domain) => {
    const domainRequirements = requirements.filter((requirement) => requirement.domainId === domain.id);
    return {
      domain: domain.title,
      requirements: domainRequirements.length,
      evidenceGaps: domainRequirements.filter((requirement) => !evidenceRequirementIds.has(requirement.id)).length,
      inProgress: domainRequirements.filter((requirement) => requirement.assessmentStatus === "in-progress").length,
      met: domainRequirements.filter((requirement) => requirement.assessmentStatus === "met").length,
      notMet: domainRequirements.filter((requirement) => requirement.assessmentStatus === "not-met" || requirement.assessmentStatus === "partially-met").length
    };
  });
  const nextRequirements = requirements
    .filter((requirement) => !evidenceRequirementIds.has(requirement.id) || requirement.assessmentStatus !== "met")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8)
    .map((requirement) => ({
      title: requirement.title,
      domain: domainName(requirement.domainId),
      status: label(requirement.assessmentStatus),
      evidence: evidenceRequirementIds.has(requirement.id) ? "Linked" : "Missing"
    }));
  const recentActivity = allEntities
    .filter((entity) => entity.entityType !== "domain" && entity.entityType !== "posture")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8)
    .map((entity) => ({
      type: label(entity.entityType),
      title: entity.title ?? entity.id,
      created: formatDisplayDate(new Date(entity.createdAt))
    }));

  const panel = vscode.window.createWebviewPanel("pspfAssessmentDashboard", "PSPF Assessment Dashboard", vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.html = shellHtml("PSPF Assessment Dashboard", `
    <section>
      <h1>Assessment Dashboard</h1>
      <p class="muted">OFFICIAL: Sensitive · ${escapeHtml(formatDisplayDate(new Date()))}</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Workspace", "Ready")}
        ${metricCard("Requirements", requirements.length)}
        ${metricCard("Evidence", evidence.length)}
        ${metricCard("Open actions", openActionCount)}
        ${metricCard("Open risks", openRiskCount)}
      </div>
      <p class="muted">Recent requirement: ${escapeHtml(recentRequirement?.title ?? "None selected yet")}</p>
    </section>
    ${recordTable("Validation Hints", validationHints, ["priority", "requirement", "hint"])}
    ${recordTable("Domain Summary", domainRows, ["domain", "requirements", "evidenceGaps", "inProgress", "met", "notMet"])}
    ${recordTable("Next Requirements To Review", nextRequirements, ["title", "domain", "status", "evidence"])}
    ${recordTable("Latest Activity", recentActivity, ["type", "title", "created"])}
  `);
}

async function openEvidenceReviewQueue(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");
  const supportedByLinks = links.filter((link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence");
  const evidenceRequirementIds = new Set(supportedByLinks.map((link) => link.fromId));
  const linkedEvidenceIds = new Set(supportedByLinks.map((link) => link.toId));
  const missingEvidence = requirements
    .filter((requirement) => !evidenceRequirementIds.has(requirement.id))
    .map((requirement) => ({ title: requirement.title, domain: domainName(requirement.domainId), status: label(requirement.assessmentStatus) }));
  const ageingEvidence = evidence
    .filter((item) => item.freshness !== "current")
    .map((item) => ({ title: item.title, freshness: label(item.freshness), reference: item.reference }));
  const unlinkedEvidence = evidence
    .filter((item) => !linkedEvidenceIds.has(item.id))
    .map((item) => ({ title: item.title, freshness: label(item.freshness), reference: item.reference }));

  const panel = vscode.window.createWebviewPanel("pspfEvidenceReviewQueue", "PSPF Evidence Review Queue", vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.html = shellHtml("PSPF Evidence Review Queue", `
    <section>
      <h1>Evidence Review Queue</h1>
      <p class="muted">OFFICIAL: Sensitive · Review missing, ageing, stale, expired, unknown, and unlinked evidence.</p>
      ${versionStrip()}
      <div class="grid">
        ${metricCard("Missing evidence", missingEvidence.length)}
        ${metricCard("Needs freshness review", ageingEvidence.length)}
        ${metricCard("Unlinked evidence", unlinkedEvidence.length)}
      </div>
    </section>
    ${recordTable("Requirements Missing Evidence", missingEvidence, ["title", "domain", "status"])}
    ${recordTable("Evidence Needing Freshness Review", ageingEvidence, ["title", "freshness", "reference"])}
    ${recordTable("Unlinked Evidence", unlinkedEvidence, ["title", "freshness", "reference"])}
  `);
}

async function openItemDetail(): Promise<void> {
  const requirement = await pickRequirement();
  if (!requirement) {
    return;
  }
  await openItemDetailForRequirement(requirement);
}

async function browseIsmSourceControls(): Promise<void> {
  await ensureCoreReady();
  const sourceControls = await listSourceControls();
  const rows = sourceControls.map((sourceControl) => ({
    controlId: sourceControl.controlId,
    title: sourceControl.title,
    profiles: sourceControl.profileTags.join(", "),
    release: sourceControl.provenance.oscalRelease,
    drift: statementChangeLabel(sourceControl.statementChangeStatus)
  }));

  const panel = vscode.window.createWebviewPanel("pspfIsmSourceControls", "PSPF ISM Source Controls", vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.html = shellHtml("PSPF ISM Source Controls", `
    <section>
      <h1>ISM Source Controls</h1>
      <p class="muted">ISM source: cyber.gov.au · ASD/ACSC · CC BY 4.0 · OSCAL release ${escapeHtml(sourceControls[0]?.provenance.oscalRelease ?? "not loaded")}.</p>
      ${versionStrip()}
    </section>
    ${recordTable("Source Controls", rows, ["controlId", "title", "profiles", "release", "drift"])}
  `);
}

async function createRequirementControlMapping(): Promise<void> {
  await ensureCoreReady();
  const requirement = await pickRequirement();
  if (!requirement) {
    return;
  }

  const sourceControl = await pickSourceControl();
  if (!sourceControl) {
    return;
  }

  const coverage = await vscode.window.showQuickPick(
    coverageQualifierItems,
    { title: "Select ISM Coverage", ignoreFocusOut: true }
  );
  if (!coverage) {
    return;
  }

  const profile = await vscode.window.showQuickPick(
    profileItems(sourceControl),
    { title: "Select ISM Applicability Profile", ignoreFocusOut: true }
  );
  if (!profile) {
    return;
  }

  const confidence = await vscode.window.showQuickPick(
    confidenceItems,
    { title: "Select Mapping Confidence", ignoreFocusOut: true }
  );
  if (!confidence) {
    return;
  }

  const reviewBy = await vscode.window.showInputBox({
    title: "Map Requirement to ISM Control",
    prompt: "Optional reviewer role or team label",
    ignoreFocusOut: true
  });
  if (reviewBy === undefined) {
    return;
  }

  const reviewedAt = new Date().toISOString();

  const rationale = await vscode.window.showInputBox({
    title: "Map Requirement to ISM Control",
    prompt: "Sensitive mapping rationale, not published by default",
    ignoreFocusOut: true
  });
  if (rationale === undefined) {
    return;
  }

  const mapping = withEnvelope(
    "requirement-control-mapping",
    {
      entityType: "requirement-control-mapping",
      title: `${requirement.title} mapped to ${sourceControl.controlId}`,
      requirementId: requirement.id,
      sourceControlId: sourceControl.id,
      coverageQualifier: coverage.value,
      applicabilityProfile: profile.value,
      confidence: confidence.value,
      lastReviewedAt: reviewedAt,
      reviewBy: reviewBy.trim() || undefined,
      rationale: rationale.trim() || undefined,
      provenance: {
        author: "workshop",
        createdAt: new Date().toISOString(),
        oscalRelease: sourceControl.provenance.oscalRelease
      }
    },
    "workshop"
  );

  await vscode.commands.executeCommand("pspf.core.upsertEntity", mapping);
  await rememberRequirement(requirement);
  const action = await vscode.window.showInformationMessage(`Mapped ${requirement.title} to ${sourceControl.controlId}.`, "Open Item Detail");
  if (action === "Open Item Detail") {
    await openItemDetailForRequirement(requirement);
  }
}

async function openItemDetailForRequirement(requirement: RequirementEntity): Promise<void> {
  await rememberRequirement(requirement);

  const allEntities = await listAllEntities();
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link" && entity.fromId === requirement.id);
  const linkedIds = new Set(links.map((link) => link.toId));
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence" && linkedIds.has(entity.id));
  const actions = allEntities.filter((entity): entity is ActionEntity => entity.entityType === "action" && linkedIds.has(entity.id));
  const risks = allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk" && linkedIds.has(entity.id));
  const sourceControlsById = new Map(allEntities.filter((entity): entity is SourceControlEntity => entity.entityType === "source-control").map((entity) => [entity.id, entity]));
  const mappings = allEntities
    .filter((entity): entity is RequirementControlMappingEntity => entity.entityType === "requirement-control-mapping" && entity.requirementId === requirement.id)
    .map((mapping) => {
      const sourceControl = sourceControlsById.get(mapping.sourceControlId);
      return {
        controlId: sourceControl?.controlId ?? mapping.sourceControlId,
        title: sourceControl?.title ?? "Unknown source control",
        coverage: label(mapping.coverageQualifier),
        profile: mapping.applicabilityProfile,
        confidence: label(mapping.confidence ?? "medium"),
        reviewed: mapping.lastReviewedAt ? formatDisplayDate(new Date(mapping.lastReviewedAt)) : "Not recorded",
        reviewer: mapping.reviewBy ?? "Not recorded",
        drift: statementChangeLabel(sourceControl?.statementChangeStatus ?? "unchanged"),
        release: mapping.provenance.oscalRelease
      };
    });
  const entitiesById = new Map(allEntities.map((entity) => [entity.id, entity]));
  const relationships = links.map((link) => ({
    title: link.title,
    relationship: label(link.linkType),
    targetType: label(link.toType),
    target: entitiesById.get(link.toId)?.title ?? label(link.toType)
  }));

  const panel = vscode.window.createWebviewPanel("pspfItemDetail", requirement.title, vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.html = shellHtml(requirement.title, `
    <section>
      <h1>${escapeHtml(requirement.title)}</h1>
      <p>Assessment status: ${escapeHtml(label(requirement.assessmentStatus))}</p>
      <p>Domain: ${escapeHtml(domainName(requirement.domainId))}</p>
      ${versionStrip()}
    </section>
    ${recordTable("Evidence", evidence, ["title", "evidenceType", "freshness", "reference"])}
    ${recordTable("Actions", actions, ["title", "status", "dueDate"])}
    ${recordTable("Risks", risks, ["title", "status", "likelihood", "impact"])}
    ${recordTable("ISM Mappings", mappings, ["controlId", "title", "coverage", "profile", "confidence", "reviewed", "reviewer", "drift", "release"])}
    ${recordTable("Relationships", relationships, ["title", "relationship", "targetType", "target"])}
  `);
}

function shellHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; color: #f4f4f5; background: #111113; }
    header { background: #18181b; color: #fafafa; border-bottom: 1px solid #3f3f46; padding: 12px 20px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    main { max-width: 920px; margin: 0 auto; padding: 20px; }
    section { background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; padding: 14px; margin-bottom: 14px; }
    h1 { margin-bottom: 6px; }
    h2 { font-size: 18px; margin-top: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
    .metric { border: 1px solid #3f3f46; border-radius: 6px; padding: 10px; background: #202024; }
    .metric span { color: #a1a1aa; display: block; font-size: 13px; }
    .metric strong { display: block; font-size: 26px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #3f3f46; vertical-align: top; }
    td { overflow-wrap: anywhere; }
    th { color: #d4d4d8; }
    .banner { background: #3f2f11; border-bottom: 1px solid #d97706; color: #fde68a; padding: 8px 20px; font-weight: 600; }
    .muted { color: #a1a1aa; }
    .version-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .version-pill { border: 1px solid #3f3f46; border-radius: 999px; padding: 3px 8px; color: #d4d4d8; background: #202024; font-size: 12px; white-space: nowrap; line-height: 1.4; }
  </style>
</head>
<body>
  <header><strong>PSPF Workshop</strong><span>v${PSPF_SLICE_VERSION}</span></header>
  <div class="banner">OFFICIAL: Sensitive</div>
  <main>
    ${body}
  </main>
</body>
</html>`;
}

async function copyPostureBrief(): Promise<void> {
  await ensureCoreReady();
  const allEntities = await listAllEntities();
  const requirements = allEntities.filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  const evidence = allEntities.filter((entity): entity is EvidenceEntity => entity.entityType === "evidence");
  const actions = allEntities.filter((entity): entity is ActionEntity => entity.entityType === "action");
  const risks = allEntities.filter((entity): entity is RiskEntity => entity.entityType === "risk");
  const links = allEntities.filter((entity): entity is LinkEntity => entity.entityType === "link");
  const brief = renderPostureBriefMarkdown({
    generatedAt: new Date(),
    requirements,
    evidence,
    actions,
    risks,
    links,
    domains: PSPF_DOMAINS,
    sourceLabel: "PSPF Workshop"
  });

  await vscode.env.clipboard.writeText(brief);
  await vscode.window.showInformationMessage("PSPF posture brief copied to clipboard.");
}

async function listAllEntities(): Promise<V01Entity[]> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities");
  return entities ?? [];
}

async function ensureCoreReady(): Promise<void> {
  await vscode.commands.executeCommand("pspf.core.ensureWorkspaceReady");
}

async function pickRequirement(): Promise<RequirementEntity | undefined> {
  await ensureCoreReady();
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "requirement");
  const requirements = (entities ?? []).filter((entity): entity is RequirementEntity => entity.entityType === "requirement");
  if (requirements.length === 0) {
    await vscode.window.showWarningMessage("Create a Requirement before adding evidence, actions, or risks.");
    return undefined;
  }

  const recentRequirementId = getRecentRequirementId();
  const picked = await vscode.window.showQuickPick(
    [...requirements]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((requirement) => {
        const domain = PSPF_DOMAINS.find((item) => item.id === requirement.domainId);
        const isRecent = requirement.id === recentRequirementId;
        return {
          label: requirement.title,
          description: `${isRecent ? "Recent · " : ""}${domain?.title ?? requirement.domainId} · ${label(requirement.assessmentStatus)}`,
          detail: `Created ${formatDisplayDate(new Date(requirement.createdAt))} · ${requirement.id}`,
          picked: isRecent,
          requirement
        };
      }),
    { title: "Select Requirement", placeHolder: "Choose the requirement to link this record to", ignoreFocusOut: true }
  );
  if (picked?.requirement) {
    await rememberRequirement(picked.requirement);
  }
  return picked?.requirement;
}

async function listSourceControls(): Promise<SourceControlEntity[]> {
  const entities = await vscode.commands.executeCommand<V01Entity[]>("pspf.core.listEntities", "source-control");
  return (entities ?? []).filter((entity): entity is SourceControlEntity => entity.entityType === "source-control");
}

async function pickSourceControl(): Promise<SourceControlEntity | undefined> {
  const sourceControls = await listSourceControls();
  if (sourceControls.length === 0) {
    await vscode.window.showWarningMessage("No ISM source controls are loaded. Run PSPF: Initialise PSPF Workspace and try again.");
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    sourceControls.map((sourceControl) => ({
      label: `${sourceControl.controlId}: ${sourceControl.title}`,
      description: sourceControl.profileTags.join(", "),
      detail: `OSCAL release ${sourceControl.provenance.oscalRelease} · ${sourceControl.statement}`,
      sourceControl
    })),
    { title: "Select ISM Source Control", placeHolder: "Choose the ISM control this requirement maps to", ignoreFocusOut: true }
  );
  return picked?.sourceControl;
}

function buildValidationHints(
  requirements: readonly RequirementEntity[],
  actions: readonly ActionEntity[],
  risks: readonly RiskEntity[],
  links: readonly LinkEntity[]
): readonly { readonly priority: string; readonly requirement: string; readonly hint: string }[] {
  const evidenceRequirementIds = new Set(links.filter((link) => link.linkType === "supported-by" && link.fromType === "requirement" && link.toType === "evidence").map((link) => link.fromId));
  const openActionIds = new Set(actions.filter((action) => !["done", "cancelled"].includes(action.status)).map((action) => action.id));
  const openRiskIds = new Set(risks.filter((risk) => risk.status !== "closed").map((risk) => risk.id));
  const actionRequirementIds = new Set(links.filter((link) => link.linkType === "addressed-by" && openActionIds.has(link.toId)).map((link) => link.fromId));
  const riskRequirementIds = new Set(links.filter((link) => link.linkType === "exposed-by" && openRiskIds.has(link.toId)).map((link) => link.fromId));
  const rows: { priority: string; requirement: string; hint: string }[] = [];

  for (const requirement of requirements) {
    if (!evidenceRequirementIds.has(requirement.id)) {
      rows.push({ priority: "High", requirement: requirement.title, hint: "No evidence linked yet." });
    }
    if (["in-progress", "partially-met", "not-met", "under-review"].includes(requirement.assessmentStatus) && !actionRequirementIds.has(requirement.id)) {
      rows.push({ priority: "Medium", requirement: requirement.title, hint: "No open action linked to this non-final assessment." });
    }
    if (riskRequirementIds.has(requirement.id) && !actionRequirementIds.has(requirement.id)) {
      rows.push({ priority: "Medium", requirement: requirement.title, hint: "Open risk has no linked open action." });
    }
  }

  return rows.slice(0, 10);
}

function getRecentRequirementId(): string | undefined {
  return workshopContext?.workspaceState.get<string>(recentRequirementKey);
}

async function rememberRequirement(requirement: RequirementEntity): Promise<void> {
  await workshopContext?.workspaceState.update(recentRequirementKey, requirement.id);
}

async function pickScore(title: string): Promise<number | undefined> {
  const picked = await vscode.window.showQuickPick(
    [1, 2, 3, 4, 5].map((value) => ({ label: String(value), value })),
    { title, ignoreFocusOut: true }
  );
  return picked?.value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function recordTable(title: string, records: readonly object[], fields: readonly string[]): string {
  if (records.length === 0) {
    return `<section><h2>${escapeHtml(title)}</h2><p class="muted">No records linked yet.</p></section>`;
  }
  const header = fields.map((field) => `<th>${escapeHtml(label(field))}</th>`).join("");
  const rows = records.map((record) => `<tr>${fields.map((field) => `<td>${escapeHtml(String(readRecordField(record, field) ?? ""))}</td>`).join("")}</tr>`).join("");
  return `<section><h2>${escapeHtml(title)}</h2><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></section>`;
}

function versionStrip(): string {
  return `<div class="version-strip" aria-label="PSPF version context"><span class="version-pill">PSPF v${PSPF_SLICE_VERSION}</span><span class="version-pill">Schema ${VERSION_AXES.schemaVersion}</span><span class="version-pill">API ${VERSION_AXES.apiVersion}</span></div>`;
}

function metricCard(label: string, value: number | string): string {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function domainName(domainId: string): string {
  return PSPF_DOMAINS.find((domain) => domain.id === domainId)?.title ?? domainId;
}

function readRecordField(record: object, field: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, field) ? (record as { readonly [key: string]: unknown })[field] : undefined;
}

function label(value: string): string {
  return value.replaceAll("-", " ").replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`).replace(/^./, (letter) => letter.toUpperCase());
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

const assessmentStatusItems: readonly { readonly label: string; readonly value: AssessmentStatus }[] = [
  { label: "Not started", value: "not-started" },
  { label: "In progress", value: "in-progress" },
  { label: "Met", value: "met" },
  { label: "Partially met", value: "partially-met" },
  { label: "Not met", value: "not-met" },
  { label: "Not applicable", value: "not-applicable" },
  { label: "Under review", value: "under-review" }
];

const evidenceTypeItems = [
  { label: "Document", value: "document" },
  { label: "URL", value: "url" },
  { label: "Note", value: "note" }
] as const;

const freshnessItems: readonly { readonly label: string; readonly value: EvidenceFreshness }[] = [
  { label: "Current", value: "current" },
  { label: "Ageing", value: "ageing" },
  { label: "Stale", value: "stale" },
  { label: "Expired", value: "expired" },
  { label: "Unknown", value: "unknown" }
];

const actionStatusItems: readonly { readonly label: string; readonly value: ActionStatus }[] = [
  { label: "Todo", value: "todo" },
  { label: "In progress", value: "in-progress" },
  { label: "Blocked", value: "blocked" },
  { label: "Done", value: "done" },
  { label: "Cancelled", value: "cancelled" }
];

const riskStatusItems: readonly { readonly label: string; readonly value: RiskStatus }[] = [
  { label: "Open", value: "open" },
  { label: "Monitored", value: "monitored" },
  { label: "Closed", value: "closed" }
];

const coverageQualifierItems = [
  { label: "Primary", value: "primary" },
  { label: "Partial", value: "partial" },
  { label: "Compensating", value: "compensating" }
] as const;

const confidenceItems: readonly { readonly label: string; readonly value: MappingConfidence; readonly description?: string; readonly picked?: boolean }[] = [
  { label: "High", value: "high", description: "Direct, stable mapping" },
  { label: "Medium", value: "medium", description: "Good working assumption", picked: true },
  { label: "Low", value: "low", description: "Needs review or weak fit" }
];

function statementChangeLabel(status: SourceControlEntity["statementChangeStatus"] | undefined): string {
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

function profileItems(sourceControl: SourceControlEntity): readonly { readonly label: string; readonly value: string }[] {
  return ["all", ...sourceControl.profileTags].map((profile) => ({ label: label(profile), value: profile }));
}
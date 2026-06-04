import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "packages", "reference-data");
const generatedPath = join(packageRoot, "src", "generated", "reference-data.ts");
const reportPath = join(packageRoot, "data", "reference-data-report.json");
const pspfPdfPath = join(
  packageRoot,
  "data",
  "sources",
  "pspf-release-2025",
  "pspf-release-2025-list-requirements.pdf"
);
const ismCatalogPath = join(packageRoot, "data", "sources", "ism-oscal", "v2026.03.24", "ISM_catalog.json");
const acscGuidanceCataloguePath = join(
  packageRoot,
  "data",
  "sources",
  "acsc-guidance",
  "v2026-06-02",
  "cyber-reference-catalogue.json"
);

const GENERATED_SCHEMA_VERSION = "1.14.0";

const PSPF_SOURCE = {
  sourceId: "pspf-release-2025-list-requirements",
  title: "PSPF Release 2025 - List of Requirements",
  sourceUrl: "https://www.protectivesecurity.gov.au/system/files/2026-04/pspf-release-2025-list-requirements.pdf",
  localPath: "packages/reference-data/data/sources/pspf-release-2025/pspf-release-2025-list-requirements.pdf",
  publicationDate: "2025-07-24",
  lastUpdated: "2026-04-21",
  licence: "Creative Commons Attribution 3.0 Australia",
  attribution: "Australian Government Department of Home Affairs"
};

const ISM_SOURCE = {
  sourceId: "ism-oscal-v2026.03.24-catalog",
  title: "Information security manual OSCAL catalog v2026.03.24",
  sourceUrl: "https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/v2026.03.24/ISM_catalog.json",
  localPath: "packages/reference-data/data/sources/ism-oscal/v2026.03.24/ISM_catalog.json",
  publicationDate: "2026-03-24",
  lastUpdated: "2026-03-24",
  licence: "Creative Commons Attribution 4.0 International",
  attribution: "Australian Signals Directorate / Australian Cyber Security Centre"
};

const ACSC_GUIDANCE_SOURCE = {
  sourceId: "acsc-guidance-cyber-reference-catalogue-v2026-06-02",
  title: "Curated ASD/ACSC cyber reference catalogue for PSPF",
  sourceUrl: "https://www.cyber.gov.au/",
  localPath: "packages/reference-data/data/sources/acsc-guidance/v2026-06-02/cyber-reference-catalogue.json",
  publicationDate: "2026-06-02",
  lastUpdated: "2026-06-02",
  licence: "Creative Commons Attribution 4.0 International",
  attribution: "Australian Signals Directorate / Australian Cyber Security Centre"
};

const currentPspfDirections = [
  {
    id: "DIR-PSPF-2026-001",
    reference: "Direction 001-2026",
    title: "Direction 001-2026 on Mitigate Vulnerabilities in Cisco SD-WAN Systems",
    issuedAt: "2026-02-26T00:00:00.000Z",
    sourceUrl:
      "https://www.protectivesecurity.gov.au/publications-library/direction-001-2026-mitigate-vulnerabilities-cisco-sd-wan-systems",
    targetRequirementIds: []
  },
  {
    id: "DIR-PSPF-2025-004",
    reference: "Direction 004-2025",
    title: "Direction 004-2025 on Commonwealth Technology Management",
    issuedAt: "2025-10-22T00:00:00.000Z",
    sourceUrl:
      "https://www.protectivesecurity.gov.au/publications-library/direction-004-2025-commonwealth-technology-management",
    targetRequirementIds: []
  },
  {
    id: "DIR-PSPF-2025-003",
    reference: "Direction 003-2025",
    title: "Direction 003-2025 Online Disclosure of Security Clearance and National Security Information",
    issuedAt: "2025-10-07T00:00:00.000Z",
    sourceUrl:
      "https://www.protectivesecurity.gov.au/publications-library/direction-003-2025-online-disclosure-security-clearance-and-national-security-information",
    targetRequirementIds: ["REQ-PSPF-2025-050"]
  },
  {
    id: "DIR-PSPF-2025-002",
    reference: "Direction 002-2025",
    title: "Direction 002-2025 on Kaspersky Lab, Inc. Products and Web Services",
    issuedAt: "2025-02-21T00:00:00.000Z",
    sourceUrl:
      "https://www.protectivesecurity.gov.au/publications-library/direction-002-2025-kaspersky-lab-inc-products-and-web-services",
    targetRequirementIds: []
  },
  {
    id: "DIR-PSPF-2025-001",
    reference: "Direction 001-2025",
    title: "Direction 001-2025 on DeepSeek Products, Applications and Web Services",
    issuedAt: "2025-02-04T00:00:00.000Z",
    sourceUrl:
      "https://www.protectivesecurity.gov.au/publications-library/direction-001-2025-deepseek-products-applications-and-web-services",
    targetRequirementIds: []
  },
  {
    id: "DIR-PSPF-2024-003",
    reference: "Direction 003-2024",
    title: "Direction 003-2024 Supporting Visibility of the Cyber Threat",
    issuedAt: "2024-07-05T00:00:00.000Z",
    sourceUrl:
      "https://www.protectivesecurity.gov.au/publications-library/direction-003-2024-supporting-visibility-cyber-threat",
    targetRequirementIds: ["REQ-PSPF-2025-215", "REQ-PSPF-2025-216"]
  },
  {
    id: "DIR-PSPF-2024-002",
    reference: "Direction 002-2024",
    title: "Direction 002-2024 Technology Asset Stocktake",
    issuedAt: "2024-07-05T00:00:00.000Z",
    sourceUrl:
      "https://www.protectivesecurity.gov.au/publications-library/direction-002-2024-technology-asset-stocktake",
    targetRequirementIds: ["REQ-PSPF-2025-211"]
  },
  {
    id: "DIR-PSPF-2024-001",
    reference: "Direction 001-2024",
    title: "Direction 001-2024 Managing Foreign Ownership, Control or Influence Risks in Technology Assets",
    issuedAt: "2024-07-05T00:00:00.000Z",
    sourceUrl:
      "https://www.protectivesecurity.gov.au/publications-library/direction-001-2024-managing-foreign-ownership-control-or-influence-risks-technology-assets",
    targetRequirementIds: ["REQ-PSPF-2025-046"]
  },
  {
    id: "DIR-PSPF-2023-001",
    reference: "Direction 001-2023",
    title: "Direction 001-2023 on the TikTok application",
    issuedAt: "2023-04-04T00:00:00.000Z",
    sourceUrl: "https://www.protectivesecurity.gov.au/publications-library/direction-001-2023-tiktok-application",
    targetRequirementIds: ["REQ-PSPF-2025-091", "REQ-PSPF-2025-092"]
  }
];

const domainDefinitions = [
  {
    family: "GOV",
    domainId: "DOM-00000000-0000-7000-8000-000000000001",
    title: "Governance",
    code: "governance",
    sortOrder: 1
  },
  {
    family: "RISK",
    domainId: "DOM-00000000-0000-7000-8000-000000000002",
    title: "Security Risk",
    code: "security-risk",
    sortOrder: 2
  },
  {
    family: "INFO",
    domainId: "DOM-00000000-0000-7000-8000-000000000003",
    title: "Information",
    code: "information",
    sortOrder: 3
  },
  {
    family: "TECH",
    domainId: "DOM-00000000-0000-7000-8000-000000000004",
    title: "Technology",
    code: "technology",
    sortOrder: 4
  },
  {
    family: "PER",
    domainId: "DOM-00000000-0000-7000-8000-000000000005",
    title: "Personnel",
    code: "personnel",
    sortOrder: 5
  },
  {
    family: "PHYS",
    domainId: "DOM-00000000-0000-7000-8000-000000000006",
    title: "Physical",
    code: "physical",
    sortOrder: 6
  }
];

const pspfRequirementTitleOverrides = new Map([[92, "Approved TikTok use on standalone devices"]]);

await mkdir(join(packageRoot, "src", "generated"), { recursive: true });
await mkdir(join(packageRoot, "data"), { recursive: true });

const pspfHash = await sha256File(pspfPdfPath);
const ismHash = await sha256File(ismCatalogPath);
const acscGuidanceHash = await sha256File(acscGuidanceCataloguePath);
const cyberReferenceCatalogue = JSON.parse(await readFile(acscGuidanceCataloguePath, "utf8"));
const sources = [
  { ...PSPF_SOURCE, sha256: pspfHash },
  { ...ISM_SOURCE, sha256: ismHash },
  { ...ACSC_GUIDANCE_SOURCE, sha256: acscGuidanceHash }
];

const pspfReferences = extractPspfRequirements(pspfPdfPath, pspfHash);
const ismSourceControlRecords = await extractIsmSourceControls(ismCatalogPath);
const themeTagsByControlId = buildThemeTagsByControlId(cyberReferenceCatalogue);
const ismSourceControls = ismSourceControlRecords.map(({ sourceControl }) =>
  applyThemeTags(sourceControl, themeTagsByControlId)
);
const ismSourceControlCategories = ismSourceControlRecords.map(({ sourceControl, category }) => ({
  controlId: sourceControl.controlId,
  category
}));
const previousIsmSourceControls = buildPreviousIsmSourceControls(ismSourceControls);
const cyberReferenceData = buildCyberReferenceData(cyberReferenceCatalogue, acscGuidanceHash, ismSourceControls);
const report = buildReport(
  pspfReferences,
  ismSourceControls,
  previousIsmSourceControls[0]?.controlId ?? "",
  cyberReferenceData
);
const pspfReferenceDomains = domainDefinitions.map(({ family, domainId, title, sortOrder }) => ({
  family,
  domainId,
  title,
  sortOrder
}));
const pspfBaselineDomains = domainDefinitions.map((domain) => ({
  id: domain.domainId,
  entityType: "domain",
  schemaVersion: GENERATED_SCHEMA_VERSION,
  title: domain.title,
  code: domain.code,
  sortOrder: domain.sortOrder,
  sourceProduct: "core",
  recordStatus: "active"
}));
const pspfBaselineRequirements = pspfReferences.map((requirement) => ({
  id: requirement.requirementId,
  entityType: "requirement",
  schemaVersion: GENERATED_SCHEMA_VERSION,
  title: formatPspfRequirementTitle(requirement),
  domainId: requirement.domainId,
  assessmentStatus: "not-started",
  sourceProduct: "core",
  recordStatus: "active"
}));
const pspfBaselineDirections = currentPspfDirections.map((direction) => ({
  id: direction.id,
  entityType: "direction",
  schemaVersion: GENERATED_SCHEMA_VERSION,
  title: direction.title,
  sourceProduct: "core",
  recordStatus: "active",
  reference: direction.reference,
  issuedAt: direction.issuedAt,
  sourceAuthority: "Department of Home Affairs",
  responseState: direction.targetRequirementIds.length > 0 ? "yes" : "not-set"
}));
const pspfBaselineDirectionLinks = currentPspfDirections.flatMap((direction) =>
  direction.targetRequirementIds.map((requirementId) => ({
    id: `LNK-PSPF-DIRECTION-${direction.reference.replace("Direction ", "").replace("-", "")}-${requirementId.replace("REQ-PSPF-2025-", "REQ")}`,
    entityType: "link",
    schemaVersion: GENERATED_SCHEMA_VERSION,
    title: `${direction.reference} is reflected in ${requirementId.replace("REQ-PSPF-2025-", "PSPF ")}`,
    sourceProduct: "core",
    recordStatus: "active",
    linkType: "targets",
    fromId: direction.id,
    fromType: "direction",
    toId: requirementId,
    toType: "requirement"
  }))
);

const generated =
  `import type { ControlThemeEntity, CyberFunctionEntity, CyberReferenceMappingEntity, DirectionEntity, DomainEntity, GuidanceFrameworkEntity, LinkEntity, MitigationStrategyEntity, RequirementEntity, SourceControlEntity } from "@pspf/contracts";\n\n` +
  `export const ISM_OSCAL_RELEASE = "v2026.03.24" as const;\n` +
  `export const REFERENCE_DATA_SOURCES = ${toConst(sources)};\n\n` +
  `export const PSPF_REFERENCE_DOMAINS = ${toConst(pspfReferenceDomains)};\n\n` +
  `export const PSPF_BASELINE_DOMAINS = ${toConst(pspfBaselineDomains)} satisfies readonly Omit<DomainEntity, "createdAt" | "updatedAt">[];\n\n` +
  `export const PSPF_REQUIREMENT_REFERENCES = ${toConst(pspfReferences)};\n\n` +
  `export const PSPF_BASELINE_REQUIREMENTS = ${toConst(pspfBaselineRequirements)} satisfies readonly Omit<RequirementEntity, "createdAt" | "updatedAt">[];\n\n` +
  `export const PSPF_BASELINE_DIRECTIONS = ${toConst(pspfBaselineDirections)} satisfies readonly Omit<DirectionEntity, "createdAt" | "updatedAt">[];\n\n` +
  `export const PSPF_BASELINE_DIRECTION_LINKS = ${toConst(pspfBaselineDirectionLinks)} satisfies readonly Omit<LinkEntity, "createdAt" | "updatedAt">[];\n\n` +
  `export const CYBER_FUNCTIONS = ${toConst(cyberReferenceData.cyberFunctions)} satisfies readonly Omit<CyberFunctionEntity, "createdAt" | "updatedAt">[];\n\n` +
  `export const MITIGATION_STRATEGIES = ${toConst(cyberReferenceData.mitigationStrategies)} satisfies readonly Omit<MitigationStrategyEntity, "createdAt" | "updatedAt">[];\n\n` +
  `export const GUIDANCE_FRAMEWORKS = ${toConst(cyberReferenceData.guidanceFrameworks)} satisfies readonly Omit<GuidanceFrameworkEntity, "createdAt" | "updatedAt">[];\n\n` +
  `export const CONTROL_THEMES = ${toConst(cyberReferenceData.controlThemes)} satisfies readonly Omit<ControlThemeEntity, "createdAt" | "updatedAt">[];\n\n` +
  `export const CYBER_REFERENCE_MAPPINGS = ${toConst(cyberReferenceData.cyberReferenceMappings)} satisfies readonly Omit<CyberReferenceMappingEntity, "createdAt" | "updatedAt">[];\n\n` +
  `export const CYBER_REFERENCE_LINKS = ${toConst(cyberReferenceData.cyberReferenceLinks)} satisfies readonly Omit<LinkEntity, "createdAt" | "updatedAt">[];\n\n` +
  `export const ISM_SOURCE_CONTROLS = ${toConst(ismSourceControls)} satisfies readonly Omit<SourceControlEntity, "createdAt" | "updatedAt">[];\n\n` +
  `export const ISM_SOURCE_CONTROL_CATEGORIES = ${toConst(ismSourceControlCategories)};\n\n` +
  `export const PREVIOUS_ISM_SOURCE_CONTROLS = ${toConst(previousIsmSourceControls)} satisfies readonly Pick<SourceControlEntity, "controlId" | "statement" | "provenance">[];\n\n` +
  `export const PSPF_REFERENCE_DATA_REPORT = ${toConst(report)};\n`;

await writeFile(generatedPath, generated, "utf8");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`generated ${relative(root, generatedPath)}`);
console.log(`generated ${relative(root, reportPath)}`);
console.log(`PSPF displayed requirements: ${report.pspf.displayedRequirementCount}`);
console.log(`PSPF missing numbers: ${report.pspf.missingRequirementNumbers.join(", ") || "none"}`);
console.log(`ISM source controls: ${report.ism.sourceControlCount}`);

async function sha256File(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function extractPspfRequirements(pdfPath, sourceHash) {
  const output = execFileSync("pdftotext", ["-raw", pdfPath, "-"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const startIndex = lines.findIndex((line) => line === "1");
  const endIndex = lines.findIndex((line) => line.startsWith("* PSPF Release 2025"));
  if (startIndex < 0 || endIndex < 0) {
    throw new Error("Could not locate PSPF mandatory requirement table in PDF extraction.");
  }

  const segment = lines.slice(startIndex, endIndex);
  const entries = [];
  for (let index = 0; index < segment.length; ) {
    if (!/^\d+\*?$/.test(segment[index] ?? "")) {
      index += 1;
      continue;
    }
    const requirementNumber = Number((segment[index] ?? "").replace("*", ""));
    const chunk = [];
    index += 1;
    while (index < segment.length && !/^\d+\*?$/.test(segment[index] ?? "")) {
      chunk.push(segment[index]);
      index += 1;
    }
    entries.push({ requirementNumber, text: normaliseWhitespace(chunk.join(" ")) });
  }

  const references = entries.map((entry) => parsePspfEntry(entry, sourceHash));
  references.sort((left, right) => left.requirementNumber - right.requirementNumber);
  return references;
}

function formatPspfRequirementTitle(requirement) {
  const prefix = `PSPF ${String(requirement.requirementNumber).padStart(3, "0")} - `;
  return `${prefix}${pspfRequirementTitleOverrides.get(requirement.requirementNumber) ?? requirement.statement}`;
}

function parsePspfEntry(entry, sourceHash) {
  const metadataPattern =
    /\b(?<domainFamily>GOV|RISK|INFO|TECH|PER|PHYS)\s+(?<sectionNumber>\d{2})\.\s+(?<rest>.+?)\s+(?<startDate>\d{1,2}\/\d{2}\/\d{4})\s+(?<releaseDecision>Retain|Modify|Retire|New)\s+(?<questionType>Yes\/No\/NA|Yes\/No|Performance)\s+(?<mandatory>Mandatory(?:\s+-\s+only\s+for\s+(?:DOS|TAE|SSPE|AVA))?|Not Mandatory)\s+(?<scored>Scored|Unscored)/;
  const match = metadataPattern.exec(entry.text);
  if (!match?.groups) {
    throw new Error(`Could not parse PSPF requirement ${entry.requirementNumber}: ${entry.text.slice(-240)}`);
  }

  const domain = domainDefinitions.find((candidate) => candidate.family === match.groups.domainFamily);
  if (!domain) {
    throw new Error(`Unknown PSPF domain family ${match.groups.domainFamily}`);
  }

  const rest = match.groups.rest.trim();
  const { sectionTitle, applicability } = splitSectionAndApplicability(rest);
  const statement = normaliseWhitespace(entry.text.slice(0, match.index));
  if (!statement) {
    throw new Error(`PSPF requirement ${entry.requirementNumber} has no statement text.`);
  }

  return {
    requirementNumber: entry.requirementNumber,
    requirementId: `REQ-PSPF-2025-${String(entry.requirementNumber).padStart(3, "0")}`,
    statement,
    domainFamily: match.groups.domainFamily,
    domainId: domain.domainId,
    sectionCode: `${match.groups.domainFamily} ${match.groups.sectionNumber}`,
    sectionTitle,
    applicability,
    startDate: normaliseSourceDate(match.groups.startDate),
    releaseDecision: match.groups.releaseDecision,
    questionType: match.groups.questionType,
    mandatory: match.groups.mandatory,
    scored: match.groups.scored,
    sourceId: PSPF_SOURCE.sourceId,
    sourceUrl: PSPF_SOURCE.sourceUrl,
    sourceHash,
    licence: PSPF_SOURCE.licence,
    attribution: PSPF_SOURCE.attribution
  };
}

function splitSectionAndApplicability(rest) {
  const applicabilityValues = [
    "All entities (Note: does not apply to the staff of Ministers employed under Part III of the Members of Parliament (Staff) Act 1984",
    "Shared Service Provider Entity",
    "Technical Authority Entity",
    "Authorised Vetting Agency",
    "Security Service Provider Entity",
    "Sponsoring Entity",
    "All entities",
    "SOGS",
    "DOS"
  ];
  const applicability = applicabilityValues.find((value) => rest.endsWith(value));
  if (!applicability) {
    throw new Error(`Could not split PSPF section/applicability: ${rest}`);
  }
  return {
    sectionTitle: rest.slice(0, -applicability.length).trim(),
    applicability
  };
}

async function extractIsmSourceControls(catalogPath) {
  const data = JSON.parse(await readFile(catalogPath, "utf8"));
  const catalog = data.catalog;
  const controls = [];

  for (const group of catalog.groups ?? []) {
    collectControls(group, controls, String(group.title ?? "Uncategorised"));
  }

  return controls.map(({ control, category }, index) => {
    const statement = normaliseWhitespace(collectProse(control).join(" ")) || control.title;
    const controlId = String(control.id ?? control.uuid ?? `ism-control-${index + 1}`);
    return {
      sourceControl: {
        id: `SRC-${stableUuid(controlId)}`,
        entityType: "source-control",
        schemaVersion: GENERATED_SCHEMA_VERSION,
        title: String(control.title ?? controlId),
        sourceProduct: "core",
        recordStatus: "active",
        controlId,
        statement,
        profileTags: ["master-catalog"],
        statementChangeStatus: index === 0 ? "changed" : "unchanged",
        externalRefs: [
          { scheme: "oscal-control-id", value: controlId },
          ...(control.uuid ? [{ scheme: "oscal-uuid", value: String(control.uuid) }] : [])
        ],
        provenance: {
          oscalRelease: "v2026.03.24",
          catalog: "ISM_catalog.json",
          profile: null,
          sourceUrl: ISM_SOURCE.sourceUrl
        }
      },
      category
    };
  });
}

function buildThemeTagsByControlId(catalogue) {
  const tags = new Map();
  for (const theme of catalogue.controlThemes ?? []) {
    for (const controlId of theme.sourcePrincipleControlIds ?? []) {
      const current = tags.get(controlId) ?? [];
      current.push(`theme:${theme.code}`);
      tags.set(controlId, current);
    }
  }
  for (const strategy of catalogue.mitigationStrategies ?? []) {
    for (const controlId of strategy.relatedControlIds ?? []) {
      const current = tags.get(controlId) ?? [];
      current.push(`strategy:${strategy.code}`);
      tags.set(controlId, current);
    }
  }
  return tags;
}

function applyThemeTags(sourceControl, tagsByControlId) {
  const tags = tagsByControlId.get(sourceControl.controlId) ?? [];
  if (tags.length === 0) {
    return sourceControl;
  }
  return {
    ...sourceControl,
    profileTags: uniqueStrings([...sourceControl.profileTags, ...tags])
  };
}

function buildCyberReferenceData(catalogue, sourceHash, sourceControls) {
  const sourceControlIds = new Set(sourceControls.map((control) => control.controlId));
  const source = sourceDescriptor(catalogue);
  const cyberFunctions = (catalogue.functions ?? []).map((item) => ({
    id: `FNC-${stableUuid(`cyber-function:${item.code}`)}`,
    entityType: "cyber-function",
    schemaVersion: GENERATED_SCHEMA_VERSION,
    title: item.title,
    sourceProduct: "core",
    recordStatus: "active",
    code: item.code,
    summary: item.summary,
    sourceFramework: "ism-cyber-security-principles",
    relatedControlIds: item.relatedControlIds,
    externalRefs: [{ scheme: "cyber.gov.au", value: item.sourceUrl }],
    provenance: { ...source, sourceUrl: item.sourceUrl }
  }));
  const mitigationStrategies = (catalogue.mitigationStrategies ?? []).map((item) => ({
    id: mitigationStrategyId(item.code),
    entityType: "mitigation-strategy",
    schemaVersion: GENERATED_SCHEMA_VERSION,
    title: item.title,
    sourceProduct: "core",
    recordStatus: "active",
    code: item.code,
    category: item.category,
    summary: item.summary,
    maturityProfiles: item.maturityProfiles,
    relatedRequirementIds: item.relatedRequirementIds,
    relatedSourceControlIds: item.relatedControlIds
      .filter((controlId) => sourceControlIds.has(controlId))
      .map(sourceControlEntityId),
    externalRefs: [{ scheme: "cyber.gov.au", value: item.sourceUrl }],
    provenance: { ...source, sourceUrl: item.sourceUrl }
  }));
  const guidanceFrameworks = (catalogue.guidanceFrameworks ?? []).map((item) => ({
    id: guidanceFrameworkId(item.code),
    entityType: "guidance-framework",
    schemaVersion: GENERATED_SCHEMA_VERSION,
    title: item.title,
    sourceProduct: "core",
    recordStatus: "active",
    code: item.code,
    summary: item.summary,
    publisher: "ASD/ACSC",
    sourceUrl: item.sourceUrl,
    retrievedAt: catalogue.retrievedAt,
    licence: catalogue.licence,
    attribution: catalogue.attribution,
    sourceHash,
    externalRefs: [{ scheme: "cyber.gov.au", value: item.sourceUrl }],
    provenance: { ...source, sourceUrl: item.sourceUrl }
  }));
  const controlThemes = (catalogue.controlThemes ?? []).map((item) => ({
    id: controlThemeId(item.code),
    entityType: "control-theme",
    schemaVersion: GENERATED_SCHEMA_VERSION,
    title: item.title,
    sourceProduct: "core",
    recordStatus: "active",
    code: item.code,
    summary: item.summary,
    sourcePrincipleControlIds: item.sourcePrincipleControlIds,
    relatedStrategyCodes: item.relatedStrategyCodes,
    externalRefs: [{ scheme: "cyber.gov.au", value: item.sourceUrl }],
    provenance: { ...source, sourceUrl: item.sourceUrl }
  }));
  const cyberReferenceMappings = buildCyberReferenceMappings(catalogue, sourceControlIds, source);
  const cyberReferenceLinks = buildCyberReferenceLinks(cyberReferenceMappings);
  return {
    cyberFunctions,
    mitigationStrategies,
    guidanceFrameworks,
    controlThemes,
    cyberReferenceMappings,
    cyberReferenceLinks
  };
}

function buildCyberReferenceMappings(catalogue, sourceControlIds, source) {
  const mappings = [];
  for (const strategy of catalogue.mitigationStrategies ?? []) {
    for (const requirementId of strategy.relatedRequirementIds ?? []) {
      mappings.push(
        cyberReferenceMapping(
          {
            fromType: "requirement",
            fromId: requirementId,
            toType: "mitigation-strategy",
            toId: mitigationStrategyId(strategy.code),
            purpose: "supports",
            confidence: "high",
            sourceUrl: strategy.sourceUrl,
            rationale: `PSPF requirement is explicitly associated with ${strategy.title}.`
          },
          source
        )
      );
    }
    for (const controlId of strategy.relatedControlIds ?? []) {
      if (!sourceControlIds.has(controlId)) {
        continue;
      }
      mappings.push(
        cyberReferenceMapping(
          {
            fromType: "source-control",
            fromId: sourceControlEntityId(controlId),
            toType: "mitigation-strategy",
            toId: mitigationStrategyId(strategy.code),
            purpose: "supports",
            confidence: "medium",
            sourceUrl: strategy.sourceUrl,
            rationale: `ISM control contributes to the ${strategy.title} mitigation strategy.`
          },
          source
        )
      );
    }
  }
  for (const theme of catalogue.controlThemes ?? []) {
    for (const controlId of theme.sourcePrincipleControlIds ?? []) {
      if (!sourceControlIds.has(controlId)) {
        continue;
      }
      mappings.push(
        cyberReferenceMapping(
          {
            fromType: "source-control",
            fromId: sourceControlEntityId(controlId),
            toType: "control-theme",
            toId: controlThemeId(theme.code),
            purpose: "themes",
            confidence: "high",
            sourceUrl: theme.sourceUrl,
            rationale: `ISM control is a curated anchor for ${theme.title}.`
          },
          source
        )
      );
    }
    for (const strategyCode of theme.relatedStrategyCodes ?? []) {
      mappings.push(
        cyberReferenceMapping(
          {
            fromType: "mitigation-strategy",
            fromId: mitigationStrategyId(strategyCode),
            toType: "control-theme",
            toId: controlThemeId(theme.code),
            purpose: "themes",
            confidence: "medium",
            sourceUrl: theme.sourceUrl,
            rationale: `Mitigation strategy contributes to the ${theme.title} theme.`
          },
          source
        )
      );
    }
  }
  return mappings;
}

function cyberReferenceMapping(input, source) {
  const idSeed = `${input.fromType}:${input.fromId}:${input.purpose}:${input.toType}:${input.toId}`;
  return {
    id: `CRM-${stableUuid(idSeed)}`,
    entityType: "cyber-reference-mapping",
    schemaVersion: GENERATED_SCHEMA_VERSION,
    title: `${input.fromId} ${input.purpose} ${input.toId}`,
    sourceProduct: "core",
    recordStatus: "active",
    from: { entityType: input.fromType, entityId: input.fromId },
    to: { entityType: input.toType, entityId: input.toId },
    purpose: input.purpose,
    confidence: input.confidence,
    rationale: input.rationale,
    lastReviewedAt: source.retrievedAt,
    reviewBy: "PSPF Reference Data Curator",
    provenance: {
      ...source,
      sourceUrl: input.sourceUrl,
      author: "PSPF Reference Data Curator",
      createdAt: source.retrievedAt
    }
  };
}

function buildCyberReferenceLinks(mappings) {
  return mappings.map((mapping) => ({
    id: `LNK-CYBER-${stableUuid(`cyber-reference-link:${mapping.id}`)}`,
    entityType: "link",
    schemaVersion: GENERATED_SCHEMA_VERSION,
    title: `${mapping.title}`,
    sourceProduct: "core",
    recordStatus: "active",
    linkType: linkTypeForCyberPurpose(mapping.purpose),
    fromId: mapping.from.entityId,
    fromType: mapping.from.entityType,
    toId: mapping.to.entityId,
    toType: mapping.to.entityType
  }));
}

function linkTypeForCyberPurpose(purpose) {
  switch (purpose) {
    case "includes":
      return "includes";
    case "sources":
      return "sourced-from";
    case "themes":
      return "related-to";
    case "implements":
    case "supports":
    case "relates":
    default:
      return "supports";
  }
}

function sourceDescriptor(catalogue) {
  return {
    sourceId: catalogue.sourceId,
    sourceUrl: "https://www.cyber.gov.au/",
    retrievedAt: catalogue.retrievedAt,
    licence: catalogue.licence,
    attribution: catalogue.attribution
  };
}

function sourceControlEntityId(controlId) {
  return `SRC-${stableUuid(controlId)}`;
}

function mitigationStrategyId(code) {
  return `MST-${stableUuid(`mitigation-strategy:${code}`)}`;
}

function guidanceFrameworkId(code) {
  return `GDC-${stableUuid(`guidance-framework:${code}`)}`;
}

function controlThemeId(code) {
  return `CTH-${stableUuid(`control-theme:${code}`)}`;
}

function collectControls(node, output, category) {
  for (const control of node.controls ?? []) {
    output.push({ control, category });
    collectControls(control, output, category);
  }
  for (const group of node.groups ?? []) {
    collectControls(group, output, category);
  }
}

function collectProse(node) {
  const prose = [];
  for (const part of node.parts ?? []) {
    if (part.prose) {
      prose.push(part.prose);
    }
    prose.push(...collectProse(part));
  }
  return prose;
}

function buildPreviousIsmSourceControls(currentControls) {
  if (currentControls.length === 0) {
    return [];
  }
  return currentControls.map((control, index) => ({
    controlId: control.controlId,
    statement: index === 0 ? `${control.statement} Previous release fixture text.` : control.statement,
    provenance: {
      oscalRelease: "v2025.12.15",
      catalog: "ISM_catalog.json",
      profile: null,
      sourceUrl: ISM_SOURCE.sourceUrl
    }
  }));
}

function buildReport(pspfReferences, ismControls, changedFixtureControlId, cyberReferenceData) {
  const numbers = pspfReferences.map((reference) => reference.requirementNumber).sort((left, right) => left - right);
  const duplicates = numbers.filter((number, index) => numbers.indexOf(number) !== index);
  const minRequirementNumber = numbers[0] ?? 0;
  const maxRequirementNumber = numbers[numbers.length - 1] ?? 0;
  const present = new Set(numbers);
  const missing = [];
  for (let number = minRequirementNumber; number <= maxRequirementNumber; number += 1) {
    if (!present.has(number)) {
      missing.push(number);
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    sources,
    pspf: {
      displayedRequirementCount: pspfReferences.length,
      minRequirementNumber,
      maxRequirementNumber,
      missingRequirementNumbers: missing,
      duplicateRequirementNumbers: duplicates,
      domainFamilies: Array.from(new Set(pspfReferences.map((reference) => reference.domainFamily))).sort(),
      publishedDirectionCount: currentPspfDirections.length,
      directionsReflectedInRequirements: currentPspfDirections.filter(
        (direction) => direction.targetRequirementIds.length > 0
      ).length
    },
    ism: {
      oscalRelease: "v2026.03.24",
      sourceControlCount: ismControls.length,
      changedFixtureControlId
    },
    cyberReference: {
      cyberFunctionCount: cyberReferenceData.cyberFunctions.length,
      mitigationStrategyCount: cyberReferenceData.mitigationStrategies.length,
      guidanceFrameworkCount: cyberReferenceData.guidanceFrameworks.length,
      controlThemeCount: cyberReferenceData.controlThemes.length,
      cyberReferenceMappingCount: cyberReferenceData.cyberReferenceMappings.length,
      cyberReferenceLinkCount: cyberReferenceData.cyberReferenceLinks.length
    }
  };
}

function normaliseWhitespace(value) {
  return value
    .replaceAll("# OFFICIAL", " ")
    .replace(/PSPF Release 2025 \(July 2025\).*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseSourceDate(value) {
  const [day, month, year] = value.split("/");
  return `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}`;
}

function stableUuid(input) {
  const hex = createHash("sha256").update(input).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7000-${hex.slice(12, 16)}-${hex.slice(16, 28)}`;
}

function uniqueStrings(values) {
  return [...new Set(values)];
}

function toConst(value) {
  return `${JSON.stringify(value, null, 2)} as const`;
}

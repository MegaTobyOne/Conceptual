import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "packages", "reference-data");
const generatedPath = join(packageRoot, "src", "generated", "reference-data.ts");
const reportPath = join(packageRoot, "data", "reference-data-report.json");
const pspfPdfPath = join(packageRoot, "data", "sources", "pspf-release-2025", "pspf-release-2025-list-requirements.pdf");
const ismCatalogPath = join(packageRoot, "data", "sources", "ism-oscal", "v2026.03.24", "ISM_catalog.json");

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

const currentPspfDirections = [
    {
        id: "DIR-PSPF-2026-001",
        reference: "Direction 001-2026",
        title: "Direction 001-2026 on Mitigate Vulnerabilities in Cisco SD-WAN Systems",
        issuedAt: "2026-02-26T00:00:00.000Z",
        sourceUrl: "https://www.protectivesecurity.gov.au/publications-library/direction-001-2026-mitigate-vulnerabilities-cisco-sd-wan-systems",
        targetRequirementIds: []
    },
    {
        id: "DIR-PSPF-2025-004",
        reference: "Direction 004-2025",
        title: "Direction 004-2025 on Commonwealth Technology Management",
        issuedAt: "2025-10-22T00:00:00.000Z",
        sourceUrl: "https://www.protectivesecurity.gov.au/publications-library/direction-004-2025-commonwealth-technology-management",
        targetRequirementIds: []
    },
    {
        id: "DIR-PSPF-2025-003",
        reference: "Direction 003-2025",
        title: "Direction 003-2025 Online Disclosure of Security Clearance and National Security Information",
        issuedAt: "2025-10-07T00:00:00.000Z",
        sourceUrl: "https://www.protectivesecurity.gov.au/publications-library/direction-003-2025-online-disclosure-security-clearance-and-national-security-information",
        targetRequirementIds: ["REQ-PSPF-2025-050"]
    },
    {
        id: "DIR-PSPF-2025-002",
        reference: "Direction 002-2025",
        title: "Direction 002-2025 on Kaspersky Lab, Inc. Products and Web Services",
        issuedAt: "2025-02-21T00:00:00.000Z",
        sourceUrl: "https://www.protectivesecurity.gov.au/publications-library/direction-002-2025-kaspersky-lab-inc-products-and-web-services",
        targetRequirementIds: []
    },
    {
        id: "DIR-PSPF-2025-001",
        reference: "Direction 001-2025",
        title: "Direction 001-2025 on DeepSeek Products, Applications and Web Services",
        issuedAt: "2025-02-04T00:00:00.000Z",
        sourceUrl: "https://www.protectivesecurity.gov.au/publications-library/direction-001-2025-deepseek-products-applications-and-web-services",
        targetRequirementIds: []
    },
    {
        id: "DIR-PSPF-2024-003",
        reference: "Direction 003-2024",
        title: "Direction 003-2024 Supporting Visibility of the Cyber Threat",
        issuedAt: "2024-07-05T00:00:00.000Z",
        sourceUrl: "https://www.protectivesecurity.gov.au/publications-library/direction-003-2024-supporting-visibility-cyber-threat",
        targetRequirementIds: ["REQ-PSPF-2025-215", "REQ-PSPF-2025-216"]
    },
    {
        id: "DIR-PSPF-2024-002",
        reference: "Direction 002-2024",
        title: "Direction 002-2024 Technology Asset Stocktake",
        issuedAt: "2024-07-05T00:00:00.000Z",
        sourceUrl: "https://www.protectivesecurity.gov.au/publications-library/direction-002-2024-technology-asset-stocktake",
        targetRequirementIds: ["REQ-PSPF-2025-211"]
    },
    {
        id: "DIR-PSPF-2024-001",
        reference: "Direction 001-2024",
        title: "Direction 001-2024 Managing Foreign Ownership, Control or Influence Risks in Technology Assets",
        issuedAt: "2024-07-05T00:00:00.000Z",
        sourceUrl: "https://www.protectivesecurity.gov.au/publications-library/direction-001-2024-managing-foreign-ownership-control-or-influence-risks-technology-assets",
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
    { family: "GOV", domainId: "DOM-00000000-0000-7000-8000-000000000001", title: "Governance", code: "governance", sortOrder: 1 },
    { family: "RISK", domainId: "DOM-00000000-0000-7000-8000-000000000002", title: "Security Risk", code: "security-risk", sortOrder: 2 },
    { family: "INFO", domainId: "DOM-00000000-0000-7000-8000-000000000003", title: "Information", code: "information", sortOrder: 3 },
    { family: "TECH", domainId: "DOM-00000000-0000-7000-8000-000000000004", title: "Technology", code: "technology", sortOrder: 4 },
    { family: "PER", domainId: "DOM-00000000-0000-7000-8000-000000000005", title: "Personnel", code: "personnel", sortOrder: 5 },
    { family: "PHYS", domainId: "DOM-00000000-0000-7000-8000-000000000006", title: "Physical", code: "physical", sortOrder: 6 }
];

await mkdir(join(packageRoot, "src", "generated"), { recursive: true });
await mkdir(join(packageRoot, "data"), { recursive: true });

const pspfHash = await sha256File(pspfPdfPath);
const ismHash = await sha256File(ismCatalogPath);
const sources = [
    { ...PSPF_SOURCE, sha256: pspfHash },
    { ...ISM_SOURCE, sha256: ismHash }
];

const pspfReferences = extractPspfRequirements(pspfPdfPath, pspfHash);
const ismSourceControls = await extractIsmSourceControls(ismCatalogPath);
const previousIsmSourceControls = buildPreviousIsmSourceControls(ismSourceControls);
const report = buildReport(pspfReferences, ismSourceControls, previousIsmSourceControls[0]?.controlId ?? "");
const pspfReferenceDomains = domainDefinitions.map(({ family, domainId, title, sortOrder }) => ({ family, domainId, title, sortOrder }));
const pspfBaselineDomains = domainDefinitions.map((domain) => ({
    id: domain.domainId,
    entityType: "domain",
    schemaVersion: "1.5.0",
    title: domain.title,
    code: domain.code,
    sortOrder: domain.sortOrder,
    sourceProduct: "core",
    recordStatus: "active"
}));
const pspfBaselineRequirements = pspfReferences.map((requirement) => ({
    id: requirement.requirementId,
    entityType: "requirement",
    schemaVersion: "1.5.0",
    title: `PSPF ${String(requirement.requirementNumber).padStart(3, "0")} - ${requirement.statement}`,
    domainId: requirement.domainId,
    assessmentStatus: "not-started",
    sourceProduct: "core",
    recordStatus: "active"
}));
const pspfBaselineDirections = currentPspfDirections.map((direction) => ({
    id: direction.id,
    entityType: "direction",
    schemaVersion: "1.5.0",
    title: direction.title,
    sourceProduct: "core",
    recordStatus: "active",
    reference: direction.reference,
    issuedAt: direction.issuedAt,
    sourceAuthority: "Department of Home Affairs",
    responseState: direction.targetRequirementIds.length > 0 ? "yes" : "not-set"
}));
const pspfBaselineDirectionLinks = currentPspfDirections.flatMap((direction) => direction.targetRequirementIds.map((requirementId) => ({
    id: `LNK-PSPF-DIRECTION-${direction.reference.replace("Direction ", "").replace("-", "")}-${requirementId.replace("REQ-PSPF-2025-", "REQ")}`,
    entityType: "link",
    schemaVersion: "1.5.0",
    title: `${direction.reference} is reflected in ${requirementId.replace("REQ-PSPF-2025-", "PSPF ")}`,
    sourceProduct: "core",
    recordStatus: "active",
    linkType: "targets",
    fromId: direction.id,
    fromType: "direction",
    toId: requirementId,
    toType: "requirement"
})));

const generated = `import type { DirectionEntity, DomainEntity, LinkEntity, RequirementEntity, SourceControlEntity } from "@pspf/contracts";\n\n` +
    `export const ISM_OSCAL_RELEASE = "v2026.03.24" as const;\n` +
    `export const REFERENCE_DATA_SOURCES = ${toConst(sources)};\n\n` +
    `export const PSPF_REFERENCE_DOMAINS = ${toConst(pspfReferenceDomains)};\n\n` +
    `export const PSPF_BASELINE_DOMAINS = ${toConst(pspfBaselineDomains)} satisfies readonly Omit<DomainEntity, "createdAt" | "updatedAt">[];\n\n` +
    `export const PSPF_REQUIREMENT_REFERENCES = ${toConst(pspfReferences)};\n\n` +
    `export const PSPF_BASELINE_REQUIREMENTS = ${toConst(pspfBaselineRequirements)} satisfies readonly Omit<RequirementEntity, "createdAt" | "updatedAt">[];\n\n` +
    `export const PSPF_BASELINE_DIRECTIONS = ${toConst(pspfBaselineDirections)} satisfies readonly Omit<DirectionEntity, "createdAt" | "updatedAt">[];\n\n` +
    `export const PSPF_BASELINE_DIRECTION_LINKS = ${toConst(pspfBaselineDirectionLinks)} satisfies readonly Omit<LinkEntity, "createdAt" | "updatedAt">[];\n\n` +
    `export const ISM_SOURCE_CONTROLS = ${toConst(ismSourceControls)} satisfies readonly Omit<SourceControlEntity, "createdAt" | "updatedAt">[];\n\n` +
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
    return createHash("sha256").update(await readFile(path)).digest("hex");
}

function extractPspfRequirements(pdfPath, sourceHash) {
    const output = execFileSync("pdftotext", ["-raw", pdfPath, "-"], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const startIndex = lines.findIndex((line) => line === "1");
    const endIndex = lines.findIndex((line) => line.startsWith("* PSPF Release 2025"));
    if (startIndex < 0 || endIndex < 0) {
        throw new Error("Could not locate PSPF mandatory requirement table in PDF extraction.");
    }

    const segment = lines.slice(startIndex, endIndex);
    const entries = [];
    for (let index = 0; index < segment.length;) {
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

function parsePspfEntry(entry, sourceHash) {
    const metadataPattern = /\b(?<domainFamily>GOV|RISK|INFO|TECH|PER|PHYS)\s+(?<sectionNumber>\d{2})\.\s+(?<rest>.+?)\s+(?<startDate>\d{1,2}\/\d{2}\/\d{4})\s+(?<releaseDecision>Retain|Modify|Retire|New)\s+(?<questionType>Yes\/No\/NA|Yes\/No|Performance)\s+(?<mandatory>Mandatory(?:\s+-\s+only\s+for\s+(?:DOS|TAE|SSPE|AVA))?|Not Mandatory)\s+(?<scored>Scored|Unscored)/;
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
        collectControls(group, controls);
    }

    return controls.map((control, index) => {
        const statement = normaliseWhitespace(collectProse(control).join(" ")) || control.title;
        const controlId = String(control.id ?? control.uuid ?? `ism-control-${index + 1}`);
        return {
            id: `SRC-${stableUuid(controlId)}`,
            entityType: "source-control",
            schemaVersion: "1.5.0",
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
        };
    });
}

function collectControls(node, output) {
    for (const control of node.controls ?? []) {
        output.push(control);
        collectControls(control, output);
    }
    for (const group of node.groups ?? []) {
        collectControls(group, output);
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

function buildReport(pspfReferences, ismControls, changedFixtureControlId) {
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
            directionsReflectedInRequirements: currentPspfDirections.filter((direction) => direction.targetRequirementIds.length > 0).length
        },
        ism: {
            oscalRelease: "v2026.03.24",
            sourceControlCount: ismControls.length,
            changedFixtureControlId
        }
    };
}

function normaliseWhitespace(value) {
    return value.replaceAll("# OFFICIAL", " ").replace(/PSPF Release 2025 \(July 2025\).*$/g, " ").replace(/\s+/g, " ").trim();
}

function normaliseSourceDate(value) {
    const [day, month, year] = value.split("/");
    return `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}`;
}

function stableUuid(input) {
    const hex = createHash("sha256").update(input).digest("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7000-${hex.slice(12, 16)}-${hex.slice(16, 28)}`;
}

function toConst(value) {
    return `${JSON.stringify(value, null, 2)} as const`;
}
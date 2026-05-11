import type { SourceControlEntity } from "@pspf/contracts";

export const ISM_OSCAL_RELEASE = "v2026.03.24" as const;
export const PREVIOUS_ISM_OSCAL_RELEASE = "v2025.12.15" as const;
export const ISM_SOURCE_URL = "https://github.com/AustralianCyberSecurityCentre/ism-oscal" as const;

export const ISM_SOURCE_CONTROLS: readonly Omit<SourceControlEntity, "createdAt" | "updatedAt">[] = [
  {
    id: "SRC-00000000-0000-7000-8000-000000000101",
    entityType: "source-control",
    schemaVersion: "1.2.0",
    title: "Application control is implemented",
    sourceProduct: "core",
    recordStatus: "active",
    controlId: "ISM-1657",
    statement: "Application control is implemented on workstations and servers to prevent unauthorised applications from executing.",
    profileTags: ["e8-ml1", "e8-ml2", "e8-ml3", "official-sensitive"],
    statementChangeStatus: "changed",
    externalRefs: [
      { scheme: "ism-control-id", value: "ISM-1657" },
      { scheme: "oscal-uuid", value: "00000000-0000-7000-8000-000000001657" }
    ],
    provenance: {
      oscalRelease: ISM_OSCAL_RELEASE,
      catalog: "ISM_catalog.json",
      profile: "official-sensitive.json",
      sourceUrl: ISM_SOURCE_URL
    }
  },
  {
    id: "SRC-00000000-0000-7000-8000-000000000102",
    entityType: "source-control",
    schemaVersion: "1.2.0",
    title: "Multi-factor authentication is used",
    sourceProduct: "core",
    recordStatus: "active",
    controlId: "ISM-1501",
    statement: "Multi-factor authentication is used to authenticate users before granting access to systems and services.",
    profileTags: ["e8-ml1", "e8-ml2", "e8-ml3", "official-sensitive"],
    statementChangeStatus: "unchanged",
    externalRefs: [
      { scheme: "ism-control-id", value: "ISM-1501" },
      { scheme: "oscal-uuid", value: "00000000-0000-7000-8000-000000001501" }
    ],
    provenance: {
      oscalRelease: ISM_OSCAL_RELEASE,
      catalog: "ISM_catalog.json",
      profile: "official-sensitive.json",
      sourceUrl: ISM_SOURCE_URL
    }
  },
  {
    id: "SRC-00000000-0000-7000-8000-000000000103",
    entityType: "source-control",
    schemaVersion: "1.2.0",
    title: "Security patches are applied to applications",
    sourceProduct: "core",
    recordStatus: "active",
    controlId: "ISM-1690",
    statement: "Security patches, updates or vendor mitigations for applications are assessed and applied within risk-based time frames.",
    profileTags: ["e8-ml1", "e8-ml2", "e8-ml3", "official-sensitive"],
    statementChangeStatus: "unchanged",
    externalRefs: [
      { scheme: "ism-control-id", value: "ISM-1690" },
      { scheme: "oscal-uuid", value: "00000000-0000-7000-8000-000000001690" }
    ],
    provenance: {
      oscalRelease: ISM_OSCAL_RELEASE,
      catalog: "ISM_catalog.json",
      profile: "official-sensitive.json",
      sourceUrl: ISM_SOURCE_URL
    }
  },
  {
    id: "SRC-00000000-0000-7000-8000-000000000104",
    entityType: "source-control",
    schemaVersion: "1.2.0",
    title: "Backups are performed and tested",
    sourceProduct: "core",
    recordStatus: "active",
    controlId: "ISM-1515",
    statement: "Backups of important data, software and configuration settings are performed and restoration processes are tested.",
    profileTags: ["e8-ml1", "e8-ml2", "e8-ml3", "official-sensitive"],
    statementChangeStatus: "unchanged",
    externalRefs: [
      { scheme: "ism-control-id", value: "ISM-1515" },
      { scheme: "oscal-uuid", value: "00000000-0000-7000-8000-000000001515" }
    ],
    provenance: {
      oscalRelease: ISM_OSCAL_RELEASE,
      catalog: "ISM_catalog.json",
      profile: "official-sensitive.json",
      sourceUrl: ISM_SOURCE_URL
    }
  }
] as const;

export const PREVIOUS_ISM_SOURCE_CONTROLS: readonly Pick<SourceControlEntity, "controlId" | "statement" | "provenance">[] = [
  {
    controlId: "ISM-1657",
    statement: "Application control is implemented on workstations to prevent unauthorised applications from executing.",
    provenance: {
      oscalRelease: PREVIOUS_ISM_OSCAL_RELEASE,
      catalog: "ISM_catalog.json",
      profile: "official-sensitive.json",
      sourceUrl: ISM_SOURCE_URL
    }
  },
  {
    controlId: "ISM-1501",
    statement: "Multi-factor authentication is used to authenticate users before granting access to systems and services.",
    provenance: {
      oscalRelease: PREVIOUS_ISM_OSCAL_RELEASE,
      catalog: "ISM_catalog.json",
      profile: "official-sensitive.json",
      sourceUrl: ISM_SOURCE_URL
    }
  },
  {
    controlId: "ISM-1690",
    statement: "Security patches, updates or vendor mitigations for applications are assessed and applied within risk-based time frames.",
    provenance: {
      oscalRelease: PREVIOUS_ISM_OSCAL_RELEASE,
      catalog: "ISM_catalog.json",
      profile: "official-sensitive.json",
      sourceUrl: ISM_SOURCE_URL
    }
  },
  {
    controlId: "ISM-1515",
    statement: "Backups of important data, software and configuration settings are performed and restoration processes are tested.",
    provenance: {
      oscalRelease: PREVIOUS_ISM_OSCAL_RELEASE,
      catalog: "ISM_catalog.json",
      profile: "official-sensitive.json",
      sourceUrl: ISM_SOURCE_URL
    }
  }
] as const;
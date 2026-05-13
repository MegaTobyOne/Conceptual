import { ISM_SOURCE_CONTROLS, PREVIOUS_ISM_SOURCE_CONTROLS, REFERENCE_DATA_SOURCES } from "@pspf/reference-data";

export { ISM_OSCAL_RELEASE, ISM_SOURCE_CONTROLS, PREVIOUS_ISM_SOURCE_CONTROLS } from "@pspf/reference-data";

export const PREVIOUS_ISM_OSCAL_RELEASE = "v2025.12.15" as const;
export const ISM_SOURCE_URL = REFERENCE_DATA_SOURCES.find((source) => source.sourceId === "ism-oscal-v2026.03.24-catalog")?.sourceUrl ?? "https://github.com/AustralianCyberSecurityCentre/ism-oscal";
export const ISM_SOURCE_CONTROL_COUNT = ISM_SOURCE_CONTROLS.length;
export const PREVIOUS_ISM_SOURCE_CONTROL_COUNT = PREVIOUS_ISM_SOURCE_CONTROLS.length;

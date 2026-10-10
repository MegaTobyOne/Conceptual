import {
  validateNarrativeRules,
  validateRegisterEntityEnvelope,
  validateRegisterLinkPairs,
  validateRegisterWriteRules,
  type LinkEntity,
  type V01Entity
} from "@pspf/contracts";
import { sha256Hex } from "./hash.ts";
import type { RegisterEntity } from "./types.ts";

export const REGISTER_IMPORT_TYPE = "pspf-workbench-register";
export const REGISTER_IMPORT_STORE_VERSION = 2;

export interface RegisterImportFile {
  type: typeof REGISTER_IMPORT_TYPE;
  storeVersion: typeof REGISTER_IMPORT_STORE_VERSION;
  sourceDatabasePathHash: string;
  recordCounts: Record<string, number>;
  newestUpdate?: string;
  entities: RegisterEntity[];
  links: LinkEntity[];
  checksum: string;
}

export class RegisterImportError extends Error {}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  const fields = Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`);
  return `{${fields.join(",")}}`;
}

export async function parseRegisterImport(text: string): Promise<RegisterImportFile> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new RegisterImportError("The selected file is not valid JSON.");
  }
  if (!isObject(value) || value.type !== REGISTER_IMPORT_TYPE) {
    throw new RegisterImportError("This is not a PSPF Workbench register migration file.");
  }
  if (value.storeVersion !== REGISTER_IMPORT_STORE_VERSION) {
    throw new RegisterImportError(`Unsupported register store version ${String(value.storeVersion)}.`);
  }
  if (typeof value.sourceDatabasePathHash !== "string" || !/^[0-9a-f]{64}$/.test(value.sourceDatabasePathHash)) {
    throw new RegisterImportError("The migration file has no valid source database path hash.");
  }
  if (!Array.isArray(value.entities) || !Array.isArray(value.links) || !isObject(value.recordCounts)) {
    throw new RegisterImportError("The migration file is missing its register records or counts.");
  }
  if (typeof value.checksum !== "string") throw new RegisterImportError("The migration file has no checksum.");

  const { checksum, ...payload } = value;
  if ((await sha256Hex(canonicalJson(payload))) !== checksum) {
    throw new RegisterImportError("The migration file checksum does not match; the file may be damaged or edited.");
  }

  const entities: RegisterEntity[] = [];
  const links: LinkEntity[] = [];
  const issues: string[] = [];
  for (const [index, record] of value.entities.entries()) {
    const errors = validateRegisterEntityEnvelope(record);
    if (errors.length) issues.push(`entities[${index}]: ${errors.join(" ")}`);
    else if ((record as V01Entity).entityType === "link")
      issues.push(`entities[${index}]: link records belong in links.`);
    else entities.push(record as RegisterEntity);
  }
  for (const [index, record] of value.links.entries()) {
    const errors = validateRegisterEntityEnvelope(record);
    if (errors.length) issues.push(`links[${index}]: ${errors.join(" ")}`);
    else if ((record as V01Entity).entityType !== "link")
      issues.push(`links[${index}]: only link records belong here.`);
    else links.push(record as LinkEntity);
  }
  const all = [...entities, ...links] as V01Entity[];
  const ids = new Set<string>();
  for (const record of all) {
    if (ids.has(record.id)) issues.push(`${record.id}: duplicate entity id.`);
    ids.add(record.id);
  }
  for (const violation of validateRegisterWriteRules(all)) issues.push(violation);
  for (const violation of validateNarrativeRules(all, [])) issues.push(violation.message);
  issues.push(...validateRegisterLinkPairs(links, entities));

  const counts: Record<string, number> = {};
  for (const record of all) counts[record.entityType] = (counts[record.entityType] ?? 0) + 1;
  if (canonicalJson(counts) !== canonicalJson(value.recordCounts))
    issues.push("recordCounts do not match the records.");
  if (issues.length) throw new RegisterImportError(issues.join("\n"));

  return value as unknown as RegisterImportFile;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

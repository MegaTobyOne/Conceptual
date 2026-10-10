import { VERSION_AXES, hasCompatibleMajorVersion } from "@pspf/contracts";
import { newId } from "./ids.ts";
import { sha256Hex } from "./hash.ts";
import type { Matter, RegisterItem, RegisterSnapshot } from "./types.ts";

export class RegisterImportError extends Error {}

const BUNDLE_TYPE = "pspf-explorer-bundle";

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const COLLECTIONS = [
  ["requirements", "register-requirement"],
  ["risks", "register-risk"],
  ["actions", "register-action"]
] as const;

/**
 * Read a master bundle as a read-only register reference (ADR 0103 §4). Only ID and title are
 * kept; anything failing manifest, version or checksum validation is rejected.
 */
export async function importRegisterBundle(
  text: string,
  now: string = new Date().toISOString()
): Promise<RegisterSnapshot> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new RegisterImportError("The selected file is not valid JSON.");
  }
  if (!isObject(value) || !isObject(value.manifest) || !isObject(value.collections)) {
    throw new RegisterImportError("Select the single master bundle JSON that embeds its collections.");
  }
  const manifest = value.manifest;
  if (manifest.bundleType !== BUNDLE_TYPE) {
    throw new RegisterImportError(`Unsupported bundle type. Expected "${BUNDLE_TYPE}".`);
  }
  for (const axis of ["schemaVersion", "bundleVersion", "apiVersion"] as const) {
    const actual = manifest[axis];
    if (typeof actual !== "string" || !hasCompatibleMajorVersion(actual, VERSION_AXES[axis])) {
      throw new RegisterImportError(`Bundle ${axis} is not compatible with ${VERSION_AXES[axis]}.`);
    }
  }

  const collections = value.collections;
  const declared = Array.isArray(manifest.collections) ? manifest.collections : [];
  for (const entry of declared) {
    if (!isObject(entry) || !isObject(entry.hash)) continue;
    if (entry.hash.alg !== "SHA-256" || typeof entry.hash.value !== "string") continue;
    const records = typeof entry.name === "string" ? collections[entry.name] : undefined;
    if (!Array.isArray(records)) continue;
    const actual = await sha256Hex(`${JSON.stringify(records, null, 2)}\n`);
    if (actual !== entry.hash.value) {
      throw new RegisterImportError(`Checksum mismatch in collection "${String(entry.name)}".`);
    }
  }

  const items: RegisterItem[] = [];
  for (const [name, kind] of COLLECTIONS) {
    const records = collections[name];
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      if (!isObject(record) || typeof record.id !== "string") continue;
      const title = [record.title, record.name].find((t): t is string => typeof t === "string") ?? record.id;
      items.push({ id: record.id, kind, title });
    }
  }

  const snapshot: RegisterSnapshot = {
    id: newId("snapshot"),
    importedAt: now,
    bundleVersion: String(manifest.bundleVersion),
    checksum: await sha256Hex(text),
    items
  };
  if (typeof manifest.generatedAt === "string") snapshot.generatedAt = manifest.generatedAt;
  return snapshot;
}

export type ReferenceStatus = "current" | "changed" | "missing" | "external" | "unchecked";

/** Compare a matter's reference with a snapshot without rewriting the reference. */
export function referenceStatus(
  ref: Matter["refs"][number],
  snapshot: RegisterSnapshot | undefined,
  checkedSnapshot: RegisterSnapshot | undefined
): ReferenceStatus {
  if (ref.kind === "external") return "external";
  if (!snapshot) return "unchecked";
  const now = snapshot.items.find((i) => i.id === ref.targetId);
  if (!now) return "missing";
  const before = checkedSnapshot?.items.find((i) => i.id === ref.targetId);
  return before && before.title === now.title ? "current" : "changed";
}

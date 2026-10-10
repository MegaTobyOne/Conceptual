import { sha256Hex } from "./hash.ts";
import type { Draft, Edition, Matter, RegisterSnapshot, Tombstone, TrailItem } from "./types.ts";

/** Store-internal migration counter (ADR 0103 §1), not a compatibility axis. */
export const STORE_VERSION = 1;
export const BACKUP_TYPE = "pspf-workbench-backup";
export const BACKUP_REMINDER_DAYS = 7;

export interface BackupData {
  matters: Matter[];
  trail: TrailItem[];
  editions: Edition[];
  drafts: Draft[];
  snapshots: RegisterSnapshot[];
  tombstones: Tombstone[];
}

export class BackupError extends Error {}

const STORE_NAMES = ["matters", "trail", "editions", "drafts", "snapshots", "tombstones"] as const;

export async function createBackup(
  data: BackupData,
  appVersion: string,
  now: string = new Date().toISOString()
): Promise<string> {
  const payload = JSON.stringify(data);
  const envelope = {
    type: BACKUP_TYPE,
    storeVersion: STORE_VERSION,
    appVersion,
    createdAt: now,
    checksum: await sha256Hex(payload),
    data
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export interface BackupSummary {
  createdAt: string;
  appVersion: string;
  counts: Record<(typeof STORE_NAMES)[number], number>;
  newestUpdate?: string;
}

export interface ParsedBackup {
  data: BackupData;
  summary: BackupSummary;
}

/** Validate shape, version and checksum before anything touches the store. */
export async function parseBackup(text: string): Promise<ParsedBackup> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BackupError("The selected file is not valid JSON.");
  }
  const env = value as Record<string, unknown> | null;
  if (!env || typeof env !== "object" || env.type !== BACKUP_TYPE) {
    throw new BackupError("This is not a PSPF Workbench backup.");
  }
  if (env.storeVersion !== STORE_VERSION) {
    throw new BackupError(`Unsupported backup store version ${String(env.storeVersion)}.`);
  }
  const data = env.data as Record<string, unknown> | undefined;
  if (!data || STORE_NAMES.some((name) => !Array.isArray(data[name]))) {
    throw new BackupError("The backup is missing one or more stores.");
  }
  if ((await sha256Hex(JSON.stringify(data))) !== env.checksum) {
    throw new BackupError("The backup checksum does not match; the file may be damaged or edited.");
  }
  const typed = data as unknown as BackupData;
  const counts = Object.fromEntries(STORE_NAMES.map((n) => [n, typed[n].length])) as BackupSummary["counts"];
  const stamps = [
    ...typed.matters.map((m) => m.updatedAt),
    ...typed.trail.map((t) => t.recordedAt),
    ...typed.editions.map((e) => e.issuedAt)
  ].sort();
  const summary: BackupSummary = {
    createdAt: String(env.createdAt),
    appVersion: String(env.appVersion),
    counts
  };
  const newest = stamps.at(-1);
  if (newest) summary.newestUpdate = newest;
  return { data: typed, summary };
}

export function backupIsDue(lastBackupAt: string | undefined, now: Date = new Date()): boolean {
  if (!lastBackupAt) return true;
  return now.getTime() - new Date(lastBackupAt).getTime() > BACKUP_REMINDER_DAYS * 86_400_000;
}

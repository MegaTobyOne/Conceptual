import { ID_PREFIXES } from "./types.ts";

const HEX = "0123456789abcdef";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => HEX[b >> 4]! + HEX[b & 15]!).join("");
}

/** UUIDv7 (ADR 0002): 48-bit ms timestamp, then version/variant bits and randomness. */
export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let ts = now;
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = toHex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type IdKind = keyof typeof ID_PREFIXES;

export function newId(kind: IdKind, now?: number): string {
  return `${ID_PREFIXES[kind]}-${uuidv7(now)}`;
}

const ID_PATTERN = /^[A-Z]{3}-[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isWorkbenchId(value: string): boolean {
  return ID_PATTERN.test(value);
}

/** Zero the timestamp bits so an exported ID leaks no creation time. */
export function stripIdTime(id: string): string {
  return id.replace(/^([A-Z]{3})-[0-9a-f]{8}-[0-9a-f]{4}-/, "$1-00000000-0000-");
}

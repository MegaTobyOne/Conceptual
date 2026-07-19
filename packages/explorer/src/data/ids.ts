/**
 * Lightweight, monotonic, lexicographically-sortable identifier (ULID-shape).
 *
 * Format: 26 chars in Crockford base32 ([0-9A-HJKMNP-TV-Z]).
 * - 10 chars timestamp (ms since epoch)
 * - 16 chars randomness from crypto.getRandomValues
 *
 * Monotonicity: if called multiple times in the same millisecond, the random
 * portion is incremented to preserve sort order.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastTime = 0;
let lastRandom: number[] = [];

function encodeBase32(bytes: number[]): string {
  return bytes.map((b) => ALPHABET[b] ?? '0').join('');
}

function randomBytes(length: number): number[] {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  // Each byte → 0..31 (5 bits) for the alphabet.
  return Array.from(out, (b) => b & 0x1f);
}

function incrementRandom(bytes: number[]): number[] {
  const next = [...bytes];
  for (let i = next.length - 1; i >= 0; i -= 1) {
    const v = (next[i] ?? 0) + 1;
    if (v < 32) {
      next[i] = v;
      return next;
    }
    next[i] = 0;
  }
  // overflow: regenerate
  return randomBytes(bytes.length);
}

function encodeTime(ms: number): string {
  const out: string[] = [];
  let n = ms;
  for (let i = 0; i < 10; i += 1) {
    out.unshift(ALPHABET[n % 32] ?? '0');
    n = Math.floor(n / 32);
  }
  return out.join('');
}

export function newId(): string {
  const now = Date.now();
  if (now === lastTime && lastRandom.length === 16) {
    lastRandom = incrementRandom(lastRandom);
  } else {
    lastTime = now;
    lastRandom = randomBytes(16);
  }
  return encodeTime(now) + encodeBase32(lastRandom);
}

export function isId(s: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(s);
}

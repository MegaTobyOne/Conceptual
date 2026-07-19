import { describe, expect, it } from 'vitest';
import { isId, newId } from './ids.ts';

describe('newId', () => {
  it('produces 26-char base32 strings', () => {
    for (let i = 0; i < 100; i += 1) {
      const id = newId();
      expect(id).toHaveLength(26);
      expect(isId(id)).toBe(true);
    }
  });

  it('produces unique values', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) set.add(newId());
    expect(set.size).toBe(10_000);
  });

  it('is monotonic across same-millisecond calls', () => {
    const a = newId();
    const b = newId();
    const c = newId();
    expect(a < b).toBe(true);
    expect(b < c).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { complianceColourVar, complianceLabel } from './compliance-display.ts';
import { COMPLIANCE_STATES } from '../data/types.ts';

describe('compliance display', () => {
  it('returns a non-empty label and CSS variable for every state', () => {
    for (const s of COMPLIANCE_STATES) {
      expect(complianceLabel(s)).toMatch(/\S/);
      expect(complianceColourVar(s)).toMatch(/^--colour-status-/);
    }
  });
  it('uses distinct labels per state', () => {
    const labels = new Set(COMPLIANCE_STATES.map(complianceLabel));
    expect(labels.size).toBe(COMPLIANCE_STATES.length);
  });
});

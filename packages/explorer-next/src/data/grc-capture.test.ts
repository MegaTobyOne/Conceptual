import { describe, it, expect } from 'vitest';
import {
  applyGrcCapture,
  GrcCaptureValidationError,
  validateGrcCapture,
  type GrcApplyTarget,
} from './grc-capture.ts';
import type { ComplianceEntry, EvidenceRef, RequirementId } from './types.ts';

function makeTarget(): GrcApplyTarget & { entries: Map<RequirementId, ComplianceEntry> } {
  const entries = new Map<RequirementId, ComplianceEntry>();
  return {
    entries,
    getEvidence(requirementId): readonly EvidenceRef[] {
      return entries.get(requirementId)?.evidence ?? [];
    },
    setCompliance(requirementId, patch): Promise<void> {
      const now = new Date().toISOString();
      const existing = entries.get(requirementId);
      entries.set(requirementId, {
        requirementId,
        state: patch.state,
        evidence: patch.evidence ?? [],
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.reviewer !== undefined ? { reviewer: patch.reviewer } : {}),
        ...(patch.reviewedAt !== undefined ? { reviewedAt: patch.reviewedAt } : {}),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      return Promise.resolve();
    },
  };
}

describe('GRC capture validation', () => {
  it('rejects unknown top-level fields', () => {
    expect(() => {
      validateGrcCapture({
        pspfGrcCapture: 'v1',
        source: 'X',
        capturedAt: '2025-01-01T00:00:00Z',
        entries: [],
        rogue: true,
      });
    }).toThrow(GrcCaptureValidationError);
  });

  it('rejects unknown entry fields', () => {
    expect(() => {
      validateGrcCapture({
        pspfGrcCapture: 'v1',
        source: 'X',
        capturedAt: '2025-01-01T00:00:00Z',
        entries: [{ requirementId: 'GOV-001', state: 'yes', extra: 1 }],
      });
    }).toThrow(/extra/);
  });

  it('rejects bad compliance state', () => {
    expect(() => {
      validateGrcCapture({
        pspfGrcCapture: 'v1',
        source: 'X',
        capturedAt: '2025-01-01T00:00:00Z',
        entries: [{ requirementId: 'GOV-001', state: 'partial' }],
      });
    }).toThrow(/state/);
  });
});

describe('GRC capture apply', () => {
  it('applies known requirement IDs and rejects unknown', async () => {
    const target = makeTarget();
    const summary = await applyGrcCapture(
      {
        pspfGrcCapture: 'v1',
        source: 'GovGRC',
        capturedAt: '2025-01-01T00:00:00Z',
        entries: [
          {
            requirementId: 'GOV-001',
            state: 'yes',
            evidenceUrl: 'https://intranet/evidence/abc',
            reviewer: 'CISO',
          },
          { requirementId: 'NOT-A-REAL-ID', state: 'no' },
        ],
      },
      target,
    );
    expect(summary.applied).toBe(1);
    expect(summary.rejected).toHaveLength(1);
    expect(summary.rejected[0]?.requirementId).toBe('NOT-A-REAL-ID');
    const govOne = target.entries.get('GOV-001' as RequirementId);
    expect(govOne?.state).toBe('yes');
    expect(govOne?.evidence[0]?.value).toBe('https://intranet/evidence/abc');
    expect(govOne?.reviewer).toBe('CISO');
  });
});

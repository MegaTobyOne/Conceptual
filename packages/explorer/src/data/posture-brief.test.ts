import { describe, expect, it } from 'vitest';
import { buildPostureBriefMarkdown } from './posture-brief.ts';
import { allRequirements } from '../pspf/index.ts';
import type { ComplianceEntry, Risk } from './types.ts';
import { asRiskId } from './types.ts';

const NOW = '2026-07-19T00:00:00.000Z';

describe('buildPostureBriefMarkdown', () => {
  it('renders the shared posture brief from local state', async () => {
    const first = allRequirements[0]!;
    const compliance = new Map<ComplianceEntry['requirementId'], ComplianceEntry>([
      [
        first.id,
        {
          requirementId: first.id,
          state: 'yes',
          evidence: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    ]);
    const risk: Risk = {
      id: asRiskId('BRIEFRISK00000000000000001'),
      title: 'Brief coverage risk',
      status: 'open',
      likelihood: 3,
      impact: 4,
      requirementIds: [first.id],
      actionIds: [],
      createdAt: NOW,
      updatedAt: NOW,
    };
    const markdown = await buildPostureBriefMarkdown(
      {
        requirements: allRequirements,
        compliance,
        risks: [risk],
        actions: [],
        directions: [],
        relationships: [],
        idMap: {},
        now: NOW,
      },
      'PSPF Explorer (browser-local)',
    );
    expect(markdown).toContain('# PSPF Posture Brief');
    expect(markdown).toContain('OFFICIAL: Sensitive');
    expect(markdown).toContain('Source: PSPF Explorer (browser-local)');
    expect(markdown).toContain('- Requirements: 1');
    expect(markdown).toContain('- Risks: 1');
  });
});

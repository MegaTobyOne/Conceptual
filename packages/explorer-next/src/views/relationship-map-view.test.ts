import { describe, expect, it } from 'vitest';
import { relationshipMapTooltipLines } from './relationship-map-view.ts';
import type { MapNode } from '../domain/relationship-map.ts';

describe('relationshipMapTooltipLines', () => {
  it('summarises a requirement with compliance state', () => {
    const node: MapNode = {
      detail: '',
      href: '',
      id: 'GOV-001',
      kind: 'requirement',
      label: 'GOV-001',
      complianceState: 'no',
    };
    expect(relationshipMapTooltipLines(node)).toEqual(['Compliance: Not yet implemented']);
  });

  it('summarises a risk with band and treatment counts', () => {
    const node: MapNode = {
      detail: '',
      href: '',
      id: 'risk-1',
      kind: 'risk',
      label: 'Test risk',
      riskBand: 'extreme',
      riskTreatment: {
        requirementsAffected: 2,
        requirementsWithGap: 1,
        actionsTreating: 3,
        activeActionsTreating: 2,
        blockedOrOverdueActionsTreating: 1,
      },
    };
    const lines = relationshipMapTooltipLines(node);
    expect(lines).toContain('Band: extreme');
    expect(lines).toContain('2 active / 3 actions');
  });

  it('summarises an action with status, overdue flag and value', () => {
    const node: MapNode = {
      detail: '',
      href: '',
      id: 'action-1',
      kind: 'action',
      label: 'Test action',
      actionStatus: 'blocked',
      actionOverdue: true,
      actionValue: {
        requirementsAddressed: 3,
        requirementsWithGap: 2,
        uniquelyCoveredRequirements: 1,
        risksTreated: 1,
        openRisksTreated: 1,
        highOrExtremeRisksTreated: 1,
      },
    };
    const lines = relationshipMapTooltipLines(node);
    expect(lines).toContain('Status: blocked');
    expect(lines).toContain('Overdue');
    expect(lines).toContain('Addresses 3 requirements · treats 1 risk');
  });

  it('summarises a direction with response state and impact', () => {
    const node: MapNode = {
      detail: '',
      href: '',
      id: 'direction-1',
      kind: 'direction',
      label: 'Test direction',
      directionResponseState: 'not-set',
      directionImpact: { requirementsModified: 4, requirementsWithGap: 2 },
    };
    const lines = relationshipMapTooltipLines(node);
    expect(lines).toContain('Response: Needs response');
    expect(lines).toContain('Affects 4 requirement(s)');
  });
});

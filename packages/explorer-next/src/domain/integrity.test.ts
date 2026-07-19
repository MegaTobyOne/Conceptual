import { describe, expect, test } from 'vitest';
import { scanIntegrity } from './integrity.ts';
import {
  asActionId,
  asDirectionId,
  asRelationshipId,
  asRequirementId,
  asRiskId,
} from '../data/types.ts';

const NOW = '2025-01-01T00:00:00.000Z';

const baseInput = {
  requirementIds: [asRequirementId('GOV-001'), asRequirementId('GOV-002')],
  risks: [],
  actions: [],
  directions: [],
  compliance: [],
  relationships: [],
} as const;

describe('scanIntegrity', () => {
  test('clean dataset produces zero issues', () => {
    const r = scanIntegrity(baseInput);
    expect(r.issues).toHaveLength(0);
    expect(r.totals.issues).toBe(0);
    expect(r.totals.records).toBe(0);
  });

  test('detects orphan requirement reference on a risk', () => {
    const r = scanIntegrity({
      ...baseInput,
      risks: [
        {
          id: asRiskId('R-1'),
          title: 'Test',
          likelihood: 3,
          impact: 3,
          status: 'open',
          requirementIds: [asRequirementId('XYZ-999')],
          actionIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    expect(r.issues.some((i) => i.kind === 'orphan-ref' && i.entity === 'risk')).toBe(true);
  });

  test('detects relationship self-loop', () => {
    const id = asRequirementId('GOV-001');
    const r = scanIntegrity({
      ...baseInput,
      relationships: [
        {
          id: asRelationshipId('rel-1'),
          kind: 'requirement-risk',
          endpoints: [id, id],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    expect(r.issues.find((i) => i.kind === 'self-loop')).toBeDefined();
  });

  test('detects relationship with dangling endpoint', () => {
    const r = scanIntegrity({
      ...baseInput,
      relationships: [
        {
          id: asRelationshipId('rel-2'),
          kind: 'requirement-risk',
          endpoints: [asRequirementId('GOV-001'), asRiskId('R-MISSING')],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    expect(r.issues.some((i) => i.kind === 'orphan-link')).toBe(true);
  });

  test('detects duplicate risk titles (case + whitespace insensitive)', () => {
    const r = scanIntegrity({
      ...baseInput,
      risks: [
        {
          id: asRiskId('R-A'),
          title: '  Insider Threat ',
          likelihood: 3,
          impact: 3,
          status: 'open',
          requirementIds: [],
          actionIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: asRiskId('R-B'),
          title: 'insider threat',
          likelihood: 2,
          impact: 4,
          status: 'open',
          requirementIds: [],
          actionIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    expect(r.issues.find((i) => i.kind === 'duplicate' && i.id === 'R-B')).toBeDefined();
  });

  test('detects orphan compliance entry', () => {
    const r = scanIntegrity({
      ...baseInput,
      compliance: [
        {
          requirementId: asRequirementId('OLD-001'),
          state: 'yes',
          evidence: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    expect(r.issues.find((i) => i.entity === 'compliance')).toBeDefined();
  });

  test('flags direction referencing duplicate references', () => {
    const r = scanIntegrity({
      ...baseInput,
      directions: [
        {
          id: asDirectionId('D-1'),
          reference: 'PSPF Direction 001-2025',
          title: 'A',
          issuedAt: '2025-01-01',
          requirementIds: [],
          responseState: 'not-set',
          evidence: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: asDirectionId('D-2'),
          reference: 'pspf direction 001-2025',
          title: 'B',
          issuedAt: '2025-01-02',
          requirementIds: [asRequirementId('NOT-EXIST')],
          responseState: 'not-set',
          evidence: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    expect(r.issues.find((i) => i.kind === 'duplicate' && i.entity === 'direction')).toBeDefined();
    expect(r.issues.find((i) => i.kind === 'orphan-ref' && i.entity === 'direction')).toBeDefined();
  });

  test('flags action referencing unknown risk', () => {
    const r = scanIntegrity({
      ...baseInput,
      actions: [
        {
          id: asActionId('A-1'),
          title: 'do thing',
          type: 'remediation',
          status: 'todo',
          requirementIds: [],
          riskIds: [asRiskId('GHOST')],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    expect(r.issues.some((i) => i.kind === 'orphan-ref' && i.entity === 'action')).toBe(true);
  });
});

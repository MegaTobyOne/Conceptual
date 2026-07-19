import { describe, expect, it } from 'vitest';
import {
  ACTION_STATUSES,
  ACTION_TYPES,
  COMPLIANCE_STATES,
  DOMAIN_KEYS,
  ESSENTIAL_EIGHT_CONTROLS,
  POSTURES,
  RISK_STATUSES,
  SCHEMA_ID,
  SCHEMA_VERSION,
  THREAT_LEVELS,
  asActionId,
  asRequirementId,
  asRiskId,
} from './types.ts';
import type { Action, ComplianceEntry, ExportEnvelope, Risk } from './types.ts';

describe('domain enumerations', () => {
  it('has six PSPF domains', () => {
    expect(DOMAIN_KEYS).toHaveLength(6);
    expect([...DOMAIN_KEYS].sort()).toEqual([
      'governance',
      'information',
      'personnel',
      'physical',
      'risk',
      'technology',
    ]);
  });

  it('has five compliance states', () => {
    expect(COMPLIANCE_STATES).toEqual(['yes', 'no', 'risk-managed', 'not-applicable', 'not-set']);
  });

  it('has eight Essential Eight controls', () => {
    expect(ESSENTIAL_EIGHT_CONTROLS).toHaveLength(8);
  });

  it('has four threat levels and three postures', () => {
    expect(THREAT_LEVELS).toHaveLength(4);
    expect(POSTURES).toHaveLength(3);
  });

  it('has expected risk and action enums', () => {
    expect(RISK_STATUSES).toHaveLength(3);
    expect(ACTION_TYPES).toHaveLength(4);
    expect(ACTION_STATUSES).toHaveLength(5);
  });
});

describe('schema identifier', () => {
  it('is pinned to v3 / version 1', () => {
    expect(SCHEMA_ID).toBe('pspf-explorer.v3');
    expect(SCHEMA_VERSION).toBe(1);
  });
});

describe('branded id constructors', () => {
  it('round-trip strings without runtime overhead', () => {
    const r = asRequirementId('GOV-001');
    expect(r).toBe('GOV-001');
    expect(asRiskId('01HX')).toBe('01HX');
    expect(asActionId('01HX')).toBe('01HX');
  });
});

describe('export envelope shape (compile-time)', () => {
  it('accepts a minimal valid envelope', () => {
    const compliance: ComplianceEntry = {
      requirementId: asRequirementId('GOV-001'),
      state: 'yes',
      evidence: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const risk: Risk = {
      id: asRiskId('01HX'),
      title: 'r',
      likelihood: 3,
      impact: 4,
      status: 'open',
      requirementIds: [],
      actionIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const action: Action = {
      id: asActionId('01HY'),
      title: 'a',
      type: 'remediation',
      status: 'todo',
      requirementIds: [],
      riskIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const envelope: ExportEnvelope = {
      schema: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      appVersion: '3.0.0-alpha.0',
      data: {
        compliance: [compliance],
        risks: [risk],
        actions: [action],
        tags: [],
        savedViews: [],
        workTracking: [],
        posture: {
          global: {
            threat: 'low',
            posture: 'standard',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          perDomain: {},
        },
      },
    };
    expect(envelope.data.risks).toHaveLength(1);
  });
});

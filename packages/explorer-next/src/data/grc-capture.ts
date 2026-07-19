/**
 * GRC capture: ingest compliance evidence emitted by an external GRC tool.
 *
 * The intake format is intentionally narrow ("locked schema") so that
 * automated pipelines can produce well-formed payloads without coupling
 * to PSPF Explorer's full data model. Validation rejects unknown fields.
 *
 * Format:
 *   {
 *     pspfGrcCapture: 'v1',
 *     source: string,           // free-text identifier of the GRC tool
 *     capturedAt: ISO8601,
 *     entries: [
 *       {
 *         requirementId: string,        // e.g. 'GOV-1'
 *         state: ComplianceState,
 *         evidenceUrl?: string,         // single canonical evidence link
 *         notes?: string,
 *         reviewer?: string,
 *         reviewedAt?: ISO8601
 *       }
 *     ]
 *   }
 */

import {
  COMPLIANCE_STATES,
  type ComplianceState,
  type EvidenceRef,
  type RequirementId,
} from './types.ts';
import { requirementById } from '../pspf/index.ts';

const FORMAT = 'pspfGrcCapture';
const VERSION = 'v1';

export interface GrcCaptureEntry {
  requirementId: string;
  state: ComplianceState;
  evidenceUrl?: string;
  notes?: string;
  reviewer?: string;
  reviewedAt?: string;
}

export interface GrcCapturePayload {
  [FORMAT]: typeof VERSION;
  source: string;
  capturedAt: string;
  entries: readonly GrcCaptureEntry[];
}

export interface GrcCaptureSummary {
  source: string;
  capturedAt: string;
  applied: number;
  rejected: { requirementId: string; reason: string }[];
}

export class GrcCaptureValidationError extends Error {}

const ALLOWED_ENTRY_KEYS = new Set([
  'requirementId',
  'state',
  'evidenceUrl',
  'notes',
  'reviewer',
  'reviewedAt',
]);

const ALLOWED_TOP_KEYS = new Set([FORMAT, 'source', 'capturedAt', 'entries']);

function ensureNoExtraKeys(obj: object, allowed: Set<string>, path: string): void {
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) {
      throw new GrcCaptureValidationError(`Unknown field "${path}.${k}"`);
    }
  }
}

function isComplianceState(s: unknown): s is ComplianceState {
  return typeof s === 'string' && (COMPLIANCE_STATES as readonly string[]).includes(s);
}

function validateIso(value: unknown, path: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new GrcCaptureValidationError(`Invalid ISO 8601 timestamp at ${path}`);
  }
  return value;
}

export function validateGrcCapture(value: unknown): asserts value is GrcCapturePayload {
  if (!value || typeof value !== 'object') {
    throw new GrcCaptureValidationError('Payload must be a JSON object.');
  }
  ensureNoExtraKeys(value, ALLOWED_TOP_KEYS, '$');
  const v = value as Record<string, unknown>;
  if (v[FORMAT] !== VERSION) {
    throw new GrcCaptureValidationError(`Unsupported format. Expected ${FORMAT}="${VERSION}".`);
  }
  if (typeof v.source !== 'string' || v.source.length === 0) {
    throw new GrcCaptureValidationError('Missing or empty "source".');
  }
  validateIso(v.capturedAt, '$.capturedAt');
  if (!Array.isArray(v.entries)) {
    throw new GrcCaptureValidationError('"entries" must be an array.');
  }
  const entries = v.entries as unknown[];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e || typeof e !== 'object') {
      throw new GrcCaptureValidationError(`entries[${i}] must be an object.`);
    }
    ensureNoExtraKeys(e, ALLOWED_ENTRY_KEYS, `$.entries[${i}]`);
    const er = e as Record<string, unknown>;
    if (typeof er.requirementId !== 'string' || er.requirementId.length === 0) {
      throw new GrcCaptureValidationError(`entries[${i}].requirementId is required.`);
    }
    if (!isComplianceState(er.state)) {
      throw new GrcCaptureValidationError(
        `entries[${i}].state must be one of ${COMPLIANCE_STATES.join(', ')}`,
      );
    }
    if (er.evidenceUrl !== undefined && typeof er.evidenceUrl !== 'string') {
      throw new GrcCaptureValidationError(`entries[${i}].evidenceUrl must be a string.`);
    }
    if (er.notes !== undefined && typeof er.notes !== 'string') {
      throw new GrcCaptureValidationError(`entries[${i}].notes must be a string.`);
    }
    if (er.reviewer !== undefined && typeof er.reviewer !== 'string') {
      throw new GrcCaptureValidationError(`entries[${i}].reviewer must be a string.`);
    }
    if (er.reviewedAt !== undefined) {
      validateIso(er.reviewedAt, `$.entries[${i}].reviewedAt`);
    }
  }
}

export interface GrcApplyTarget {
  setCompliance(
    requirementId: RequirementId,
    patch: {
      state: ComplianceState;
      evidence?: readonly EvidenceRef[];
      notes?: string;
      reviewer?: string;
      reviewedAt?: string;
    },
  ): Promise<unknown>;
  getEvidence(requirementId: RequirementId): readonly EvidenceRef[];
}

export async function applyGrcCapture(
  payload: unknown,
  target: GrcApplyTarget,
): Promise<GrcCaptureSummary> {
  validateGrcCapture(payload);
  const summary: GrcCaptureSummary = {
    source: payload.source,
    capturedAt: payload.capturedAt,
    applied: 0,
    rejected: [],
  };
  for (const entry of payload.entries) {
    if (!requirementById.has(entry.requirementId as RequirementId)) {
      summary.rejected.push({
        requirementId: entry.requirementId,
        reason: 'unknown requirement ID',
      });
      continue;
    }
    const reqId = entry.requirementId as RequirementId;
    const existing = target.getEvidence(reqId);
    const evidence: readonly EvidenceRef[] = entry.evidenceUrl
      ? [
          ...existing,
          {
            kind: 'url',
            value: entry.evidenceUrl,
            addedAt: payload.capturedAt,
          },
        ]
      : existing;
    await target.setCompliance(reqId, {
      state: entry.state,
      evidence,
      ...(entry.notes !== undefined ? { notes: entry.notes } : {}),
      ...(entry.reviewer !== undefined ? { reviewer: entry.reviewer } : {}),
      ...(entry.reviewedAt !== undefined ? { reviewedAt: entry.reviewedAt } : {}),
    });
    summary.applied += 1;
  }
  return summary;
}

import type { Direction, DirectionResponseState, EvidenceRef } from '../data/types.ts';

export function directionResponseLabel(state: DirectionResponseState): string {
  switch (state) {
    case 'yes':
      return 'Dealt with';
    case 'no':
      return 'Not dealt with';
    case 'risk-managed':
      return 'Risk-managed';
    case 'not-set':
      return 'Needs response';
  }
}

function directionResponseSummaryLabel(state: DirectionResponseState): string {
  switch (state) {
    case 'yes':
      return 'Yes';
    case 'no':
      return 'No';
    case 'risk-managed':
      return 'Risk-managed';
    case 'not-set':
      return 'Needs response';
  }
}

function evidenceLines(evidence: readonly EvidenceRef[]): string[] {
  if (evidence.length === 0) return ['Evidence: none recorded'];
  return [
    'Evidence:',
    ...evidence.map((entry, index) => `  ${index + 1}. ${entry.kind}: ${entry.value}`),
  ];
}

export function directionSummary(direction: Direction): string {
  const lines = [
    `${direction.reference}: ${direction.title}`,
    `Response: ${directionResponseSummaryLabel(direction.responseState)}`,
    `Issued: ${direction.issuedAt}`,
  ];
  if (direction.requirementIds.length > 0) {
    lines.push(`Linked requirements: ${direction.requirementIds.join(', ')}`);
  }
  if (direction.description) lines.push(`Description: ${direction.description}`);
  if (direction.responseNotes) lines.push(`Response notes: ${direction.responseNotes}`);
  lines.push(...evidenceLines(direction.evidence));
  return lines.join('\n');
}

export function directionsRegisterSummary(directions: readonly Direction[]): string {
  if (directions.length === 0) return 'No PSPF Directions recorded.';
  const counts = directions.reduce<Record<DirectionResponseState, number>>(
    (acc, direction) => {
      acc[direction.responseState] += 1;
      return acc;
    },
    { yes: 0, no: 0, 'risk-managed': 0, 'not-set': 0 },
  );
  return [
    'PSPF Directions register',
    `Total: ${directions.length}`,
    `Dealt with: ${counts.yes}`,
    `Not dealt with: ${counts.no}`,
    `Risk-managed: ${counts['risk-managed']}`,
    `Needs response: ${counts['not-set']}`,
    '',
    ...directions.map(directionSummary),
  ].join('\n');
}

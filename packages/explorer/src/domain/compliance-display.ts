/**
 * Compliance state presentation helpers.
 * Pure mapping from ComplianceState to a label and a CSS hue token.
 */

import type { ComplianceState } from '../data/types.ts';

export function complianceLabel(state: ComplianceState): string {
  switch (state) {
    case 'yes':
      return 'Fully implemented';
    case 'no':
      return 'Not yet implemented';
    case 'risk-managed':
      return 'Risk-managed';
    case 'not-applicable':
      return 'Not applicable';
    case 'not-set':
      return 'Not set';
  }
}

/** CSS custom-property name (without var()) for the colour swatch of this state. */
export function complianceColourVar(state: ComplianceState): string {
  return `--colour-status-${state}`;
}

// Hand-curated Essential Eight control catalogue.
// Linkage from individual PSPF Technology requirements is inferred during data porting.

import type { EssentialEightControl } from '../data/types.ts';

export const essentialEightControls: readonly EssentialEightControl[] = [
  {
    key: 'patch-applications',
    name: 'Patch applications',
    description:
      'Apply security vulnerability patches and updates to applications in a timely manner to reduce exposure to known exploits.',
    maturityLevels: [1, 2, 3],
  },
  {
    key: 'patch-operating-systems',
    name: 'Patch operating systems',
    description:
      'Apply security vulnerability patches and updates to operating systems in a timely manner.',
    maturityLevels: [1, 2, 3],
  },
  {
    key: 'multi-factor-authentication',
    name: 'Multi-factor authentication',
    description:
      'Use multi-factor authentication for users and privileged operations to reduce the risk of credential compromise.',
    maturityLevels: [1, 2, 3],
  },
  {
    key: 'restrict-administrative-privileges',
    name: 'Restrict administrative privileges',
    description:
      'Limit administrative privileges based on user duties and revalidate periodically.',
    maturityLevels: [1, 2, 3],
  },
  {
    key: 'application-control',
    name: 'Application control',
    description:
      'Restrict the set of applications that may execute on systems to prevent unapproved or malicious code from running.',
    maturityLevels: [1, 2, 3],
  },
  {
    key: 'restrict-microsoft-office-macros',
    name: 'Restrict Microsoft Office macros',
    description:
      'Block or strictly control Microsoft Office macros to reduce risk from macro-based threats.',
    maturityLevels: [1, 2, 3],
  },
  {
    key: 'user-application-hardening',
    name: 'User application hardening',
    description:
      'Harden user-facing applications (web browsers, PDF readers, Office) to reduce exposure to common attack techniques.',
    maturityLevels: [1, 2, 3],
  },
  {
    key: 'regular-backups',
    name: 'Regular backups',
    description:
      'Perform and validate regular backups of important data, software, and configuration with appropriate retention.',
    maturityLevels: [1, 2, 3],
  },
];

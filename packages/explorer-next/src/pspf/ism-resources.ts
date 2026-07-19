export interface IsmResource {
  id: string;
  title: string;
  category: 'manual' | 'changes' | 'chapters' | 'formats';
  release: string;
  url: string;
}

export const ismResources: readonly IsmResource[] = [
  {
    id: 'ism-manual-june-2026',
    title: 'Information security manual (June 2026)',
    category: 'manual',
    release: 'June 2026',
    url: 'https://www.cyber.gov.au/sites/default/files/2026-06/Information%20security%20manual%20%28June%202026%29.pdf',
  },
  {
    id: 'ism-june-2026-changes',
    title: 'ISM June 2026 changes',
    category: 'changes',
    release: 'June 2026',
    url: 'https://www.cyber.gov.au/sites/default/files/2026-06/ISM%20June%202026%20changes%20%28June%202026%29.pdf',
  },
  {
    id: 'ism-overview',
    title: 'Information security manual overview',
    category: 'chapters',
    release: 'Current',
    url: 'https://www.cyber.gov.au/business-government/asds-cyber-security-frameworks/ism',
  },
  {
    id: 'ism-using-the-manual',
    title: 'Using the Information security manual',
    category: 'chapters',
    release: 'Current',
    url: 'https://www.cyber.gov.au/business-government/asds-cyber-security-frameworks/ism/using-the-information-security-manual',
  },
  {
    id: 'ism-cyber-security-principles',
    title: 'ISM cyber security principles',
    category: 'chapters',
    release: 'Current',
    url: 'https://www.cyber.gov.au/business-government/asds-cyber-security-frameworks/ism/cyber-security-principles',
  },
  {
    id: 'ism-cyber-security-guidelines',
    title: 'ISM cyber security guidelines',
    category: 'chapters',
    release: 'Current',
    url: 'https://www.cyber.gov.au/business-government/asds-cyber-security-frameworks/ism/cyber-security-guidelines',
  },
  {
    id: 'ism-terminology',
    title: 'ISM cyber security terminology',
    category: 'chapters',
    release: 'Current',
    url: 'https://www.cyber.gov.au/business-government/asds-cyber-security-frameworks/ism/cyber-security-terminology',
  },
  {
    id: 'ism-oscal-releases',
    title: 'ISM OSCAL releases',
    category: 'formats',
    release: 'Current',
    url: 'https://www.cyber.gov.au/business-government/asds-cyber-security-frameworks/ism/ism-oscal-releases',
  },
];

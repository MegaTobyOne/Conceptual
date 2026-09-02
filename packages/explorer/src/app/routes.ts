import type { RouteSpec } from './router.ts';

// E6 (v1.68.0, ADR 0096): two groups only — essentials (≤ 7 nav items, always visible) and
// advanced (everything else, demoted behind one disclosure). No per-topic groups.
export type NavGroupKey = 'essentials' | 'advanced';

export interface NavRoute {
  path: string;
  label: string;
  group: NavGroupKey;
}

export const NAV_GROUPS: readonly { key: NavGroupKey; label: string }[] = [
  { key: 'essentials', label: 'Essentials' },
  { key: 'advanced', label: 'Advanced' },
];

export const routes: readonly RouteSpec[] = [
  { path: '/', component: 'pspf-home-view', load: () => import('../views/home-view.ts') },
  {
    path: '/domain/:key',
    component: 'pspf-domain-view',
    load: () => import('../views/domain-view.ts'),
  },
  {
    path: '/requirements',
    component: 'pspf-requirements-view',
    load: () => import('../views/requirements-view.ts'),
  },
  {
    path: '/requirements/:domain',
    component: 'pspf-requirements-view',
    load: () => import('../views/requirements-view.ts'),
  },
  {
    path: '/requirement/:id',
    component: 'pspf-requirement-view',
    load: () => import('../views/requirement-view.ts'),
  },
  { path: '/risks', component: 'pspf-risks-view', load: () => import('../views/risks-view.ts') },
  {
    path: '/actions',
    component: 'pspf-actions-view',
    load: () => import('../views/actions-view.ts'),
  },
  { path: '/tags', component: 'pspf-tags-view', load: () => import('../views/tags-view.ts') },
  {
    path: '/views',
    component: 'pspf-saved-views-view',
    load: () => import('../views/saved-views-view.ts'),
  },
  {
    path: '/posture',
    component: 'pspf-posture-view',
    load: () => import('../views/posture-view.ts'),
  },
  {
    path: '/analytics',
    component: 'pspf-analytics-view',
    load: () => import('../views/analytics-view.ts'),
  },
  {
    path: '/coverage',
    component: 'pspf-coverage-view',
    load: () => import('../views/coverage-view.ts'),
  },
  {
    path: '/essential-eight',
    component: 'pspf-essential-eight-view',
    load: () => import('../views/essential-eight-view.ts'),
  },
  {
    path: '/directions/:state',
    component: 'pspf-directions-view',
    load: () => import('../views/directions-view.ts'),
  },
  {
    path: '/directions',
    component: 'pspf-directions-view',
    load: () => import('../views/directions-view.ts'),
  },
  {
    path: '/relationships',
    component: 'pspf-relationships-view',
    load: () => import('../views/relationships-view.ts'),
  },
  {
    path: '/share',
    component: 'pspf-share-view',
    load: () => import('../views/share-view.ts'),
  },
  {
    path: '/import',
    component: 'pspf-risk-action-import-view',
    load: () => import('../views/risk-action-import-view.ts'),
  },
  {
    path: '/core',
    component: 'pspf-core-exchange-view',
    load: () => import('../views/core-exchange-view.ts'),
  },
  {
    path: '/backup',
    component: 'pspf-backup-view',
    load: () => import('../views/backup-view.ts'),
  },
  {
    path: '/restore',
    component: 'pspf-restore-view',
    load: () => import('../views/restore-view.ts'),
  },
  {
    path: '/integrity',
    component: 'pspf-integrity-view',
    load: () => import('../views/integrity-view.ts'),
  },
  { path: '/help', component: 'pspf-help-view', load: () => import('../views/help-view.ts') },
  {
    path: '(.*)',
    component: 'pspf-not-found-view',
    load: () => import('../views/not-found-view.ts'),
  },
];

export const NAV_ROUTES: readonly NavRoute[] = [
  { path: '/', label: 'Home', group: 'essentials' },
  { path: '/requirements', label: 'Requirements', group: 'essentials' },
  { path: '/risks', label: 'Risks', group: 'essentials' },
  { path: '/actions', label: 'Actions', group: 'essentials' },
  { path: '/directions', label: 'Directions', group: 'essentials' },
  { path: '/relationships', label: 'Relationships', group: 'essentials' },
  { path: '/posture', label: 'Posture', group: 'essentials' },
  { path: '/analytics', label: 'Analytics', group: 'advanced' },
  { path: '/coverage', label: 'Coverage', group: 'advanced' },
  { path: '/integrity', label: 'Integrity', group: 'advanced' },
  { path: '/tags', label: 'Tags', group: 'advanced' },
  { path: '/views', label: 'Saved views', group: 'advanced' },
  { path: '/share', label: 'Share', group: 'advanced' },
  { path: '/core', label: 'Core exchange', group: 'advanced' },
  { path: '/backup', label: 'Backup', group: 'advanced' },
  { path: '/restore', label: 'Restore', group: 'advanced' },
  { path: '/import', label: 'Import work', group: 'advanced' },
  { path: '/help', label: 'Help', group: 'advanced' },
];

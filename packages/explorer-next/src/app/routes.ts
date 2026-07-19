import type { RouteSpec } from './router.ts';

export type NavGroupKey = 'work' | 'analyse' | 'organise' | 'share';

export interface NavRoute {
  path: string;
  label: string;
  group: NavGroupKey;
}

export const NAV_GROUPS: readonly { key: NavGroupKey; label: string }[] = [
  { key: 'work', label: 'Work' },
  { key: 'analyse', label: 'Analyse' },
  { key: 'organise', label: 'Organise' },
  { key: 'share', label: 'Share/Data' },
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
    path: '/map',
    component: 'pspf-relationship-map-view',
    load: () => import('../views/relationship-map-view.ts'),
  },
  {
    path: '/share',
    component: 'pspf-share-view',
    load: () => import('../views/share-view.ts'),
  },
  {
    path: '/grc',
    component: 'pspf-grc-view',
    load: () => import('../views/grc-view.ts'),
  },
  {
    path: '/import',
    component: 'pspf-risk-action-import-view',
    load: () => import('../views/risk-action-import-view.ts'),
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
  { path: '/', label: 'Home', group: 'work' },
  { path: '/directions', label: 'Directions', group: 'work' },
  { path: '/risks', label: 'Risks', group: 'work' },
  { path: '/actions', label: 'Actions', group: 'work' },
  { path: '/relationships', label: 'Relationships', group: 'work' },
  { path: '/analytics', label: 'Analytics', group: 'analyse' },
  { path: '/coverage', label: 'Coverage', group: 'analyse' },
  { path: '/map', label: 'Map', group: 'analyse' },
  { path: '/integrity', label: 'Integrity', group: 'analyse' },
  { path: '/tags', label: 'Tags', group: 'organise' },
  { path: '/views', label: 'Saved views', group: 'organise' },
  { path: '/posture', label: 'Posture', group: 'organise' },
  { path: '/share', label: 'Share', group: 'share' },
  { path: '/backup', label: 'Backup', group: 'share' },
  { path: '/restore', label: 'Restore', group: 'share' },
  { path: '/grc', label: 'GRC capture', group: 'share' },
  { path: '/import', label: 'Import work', group: 'share' },
  { path: '/help', label: 'Help', group: 'share' },
];

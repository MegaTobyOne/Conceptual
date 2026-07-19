// Generates the published sample bundles (enterprise + home) into dist/.
// Ported from the retired static Explorer's build-static.mjs so the sample
// data contract survives the Vite/Lit cutover (ADR 0084).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERSION_AXES,
  buildSampleWorkspaceEntities,
  buildHomeSampleWorkspaceEntities,
  sanitiseEntityForPublication,
} from '@pspf/contracts';
import { ISM_SOURCE_CONTROLS, PSPF_BASELINE_DOMAINS } from '@pspf/reference-data';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
await mkdir(dist, { recursive: true });

const ENTITY_TYPE_TO_COLLECTION = {
  domain: 'domains',
  requirement: 'requirements',
  evidence: 'evidence',
  action: 'actions',
  risk: 'risks',
  snapshot: 'snapshots',
  link: 'links',
  tag: 'tags',
  'saved-view': 'saved-views',
  'source-control': 'source-controls',
  'requirement-control-mapping': 'requirement-control-mappings',
  direction: 'directions',
  'change-record': 'change-records',
  supplier: 'suppliers',
  contract: 'contracts',
  'spend-item': 'spend-items',
  strategy: 'strategies',
  posture: 'posture',
};

function assembleSampleBundle(rawEntities, label) {
  const now = new Date().toISOString();
  const entities = rawEntities.map((entity) => {
    const withTimestamps = {
      createdAt: entity.createdAt ?? now,
      updatedAt: entity.updatedAt ?? now,
      recordStatus: entity.recordStatus ?? 'active',
      sourceProduct: entity.sourceProduct ?? 'core',
      schemaVersion: entity.schemaVersion ?? VERSION_AXES.schemaVersion,
      ...entity,
    };
    return sanitiseEntityForPublication(withTimestamps);
  });
  const collections = {};
  for (const entity of entities) {
    const collection = ENTITY_TYPE_TO_COLLECTION[entity.entityType];
    if (!collection) continue;
    (collections[collection] ??= []).push(entity);
  }
  const manifestCollections = Object.entries(collections).map(([name, items]) => ({
    name,
    path: './collections/' + name + '.json',
    count: items.length,
  }));
  return {
    manifest: {
      bundleType: 'pspf-explorer-bundle',
      bundleVersion: VERSION_AXES.bundleVersion,
      schemaVersion: VERSION_AXES.schemaVersion,
      apiVersion: VERSION_AXES.apiVersion,
      generatedAt: now,
      generator: { product: 'pspf-explorer', profile: 'sample-' + label },
      security: { classification: 'OFFICIAL: Sensitive', redactionProfile: 'explorer-default' },
      collections: manifestCollections,
    },
    collections,
  };
}

function buildSampleBundleFor(variant) {
  const sample =
    variant === 'home'
      ? buildHomeSampleWorkspaceEntities({ sourceControls: ISM_SOURCE_CONTROLS })
      : buildSampleWorkspaceEntities({ sourceControls: ISM_SOURCE_CONTROLS });

  const referencedDomainIds = new Set(
    sample
      .filter((entity) => entity.entityType === 'requirement' && entity.domainId)
      .map((entity) => entity.domainId),
  );
  const domains = PSPF_BASELINE_DOMAINS.filter((domain) => referencedDomainIds.has(domain.id));

  const referencedControlIds = new Set(
    sample
      .filter((entity) => entity.entityType === 'requirement-control-mapping')
      .map((entity) => entity.controlId),
  );
  const sourceControls = ISM_SOURCE_CONTROLS.filter((control) =>
    referencedControlIds.has(control.id),
  );

  return assembleSampleBundle([...domains, ...sourceControls, ...sample], variant);
}

const enterpriseBundle = buildSampleBundleFor('enterprise');
const homeBundle = buildSampleBundleFor('home');
const enterpriseBundleJson = JSON.stringify(enterpriseBundle, null, 2);
const homeBundleJson = JSON.stringify(homeBundle, null, 2);
await writeFile(join(dist, 'sample-bundle-enterprise.json'), enterpriseBundleJson + '\n', 'utf8');
await writeFile(join(dist, 'sample-bundle-home.json'), homeBundleJson + '\n', 'utf8');
// Back-compat: alias enterprise as the default sample-bundle.json.
await writeFile(join(dist, 'sample-bundle.json'), enterpriseBundleJson + '\n', 'utf8');

console.log('ok sample bundles written to dist/ (enterprise, home, default alias)');

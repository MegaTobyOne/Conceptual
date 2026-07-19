import { renderPostureBriefMarkdown } from '@pspf/brief-renderer';
import type { PostureBriefInput } from '@pspf/brief-renderer';
import { buildCoreBundleExport, type CoreExportInput } from './core-bundle.ts';

/**
 * Render the operator posture brief (AU-English Markdown) from the current
 * app state, using the shared @pspf/brief-renderer so the wording matches
 * briefs produced by Core and Workshop. The state is first assembled into a
 * master bundle (the same shape used for Core exchange), then handed to the
 * shared renderer.
 */
export async function buildPostureBriefMarkdown(
  input: CoreExportInput,
  sourceLabel: string,
): Promise<string> {
  const { bundle } = await buildCoreBundleExport(input);
  const collections = bundle.collections;
  // The exported collections are bundle-shaped records (the same envelope the
  // shared renderer consumes); the cast bridges the loose CoreRecord type to
  // the renderer's entity types.
  const briefInput = {
    generatedAt: new Date(),
    requirements: collections.requirements ?? [],
    evidence: collections.evidence ?? [],
    actions: collections.actions ?? [],
    risks: collections.risks ?? [],
    links: collections.links ?? [],
    domains: collections.domains ?? [],
    directions: collections.directions ?? [],
    strategies: collections.strategies ?? [],
    requirementControlMappings: collections['requirement-control-mappings'] ?? [],
    sourceControls: collections['source-controls'] ?? [],
    sourceLabel,
    bundleVersion: bundle.manifest.bundleVersion,
    schemaVersion: bundle.manifest.schemaVersion,
  } as unknown as PostureBriefInput;
  return renderPostureBriefMarkdown(briefInput);
}

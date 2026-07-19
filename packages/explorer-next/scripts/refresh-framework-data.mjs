/**
 * One-off source refresh helper.
 *
 * Purpose:
 * - Download authoritative PSPF and ISM source artefacts.
 * - Record immutable checksums and fetch metadata in a manifest.
 * - Run lightweight content checks so refreshes are auditable.
 *
 * Run from repo root:
 *   node scripts/refresh-framework-data.mjs
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const outDir = resolve(repoRoot, 'source-data', 'framework-refresh', '2026-07');

/** @type {readonly { id: string; url: string; fileName: string; checks: readonly string[] }[]} */
const SOURCES = [
  {
    id: 'pspf-2026-list-requirements',
    url: 'https://www.protectivesecurity.gov.au/system/files/2026-07/pspf-release-2026-list-requirements_0.pdf',
    fileName: 'pspf-release-2026-list-requirements_0.pdf',
    checks: ['PSPF Release 2026', 'List of Requirements', 'Req Number'],
  },
  {
    id: 'pspf-2026-summary-changes',
    url: 'https://www.protectivesecurity.gov.au/system/files/2026-07/pspf-release-2026-summary-changes_0.pdf',
    fileName: 'pspf-release-2026-summary-changes_0.pdf',
    checks: ['PSPF Release 2026', 'Summary of Changes'],
  },
  {
    id: 'ism-2026-manual',
    url: 'https://www.cyber.gov.au/sites/default/files/2026-06/Information%20security%20manual%20%28June%202026%29.pdf',
    fileName: 'information-security-manual-june-2026.pdf',
    checks: ['Information security manual', 'June 2026'],
  },
  {
    id: 'ism-2026-changes',
    url: 'https://www.cyber.gov.au/sites/default/files/2026-06/ISM%20June%202026%20changes%20%28June%202026%29.pdf',
    fileName: 'ism-june-2026-changes.pdf',
    checks: ['ISM', 'June 2026'],
  },
];

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`);
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    bytes: Buffer.from(await response.arrayBuffer()),
  };
}

async function extractPdfText(path) {
  try {
    const { stdout } = await execFile('pdftotext', [path, '-']);
    return stdout;
  } catch (error) {
    const e = /** @type {NodeJS.ErrnoException} */ (error);
    if (e.code === 'ENOENT') {
      throw new Error('pdftotext is required for source validation but was not found on PATH.');
    }
    throw error;
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });

  /** @type {Array<Record<string, unknown>>} */
  const artefacts = [];

  for (const source of SOURCES) {
    const { status, contentType, bytes } = await fetchBytes(source.url);
    if (bytes.length < 1024) throw new Error(`Downloaded file too small for ${source.id}`);

    const filePath = resolve(outDir, source.fileName);
    await writeFile(filePath, bytes);

    const text = await extractPdfText(filePath);
    const missingChecks = source.checks.filter((snippet) => !text.includes(snippet));
    if (missingChecks.length > 0) {
      throw new Error(
        `Validation failed for ${source.id}; missing snippets: ${missingChecks.join(', ')}`,
      );
    }

    artefacts.push({
      id: source.id,
      url: source.url,
      fileName: source.fileName,
      status,
      contentType,
      sizeBytes: bytes.length,
      sha256: sha256Hex(bytes),
      checks: source.checks,
      validatedAt: new Date().toISOString(),
    });
  }

  const manifestPath = resolve(outDir, 'source-manifest.json');
  const manifest = {
    schema: 'pspf-explorer.framework-refresh.v1',
    generatedAt: new Date().toISOString(),
    note: 'One-off framework source refresh evidence for PSPF + ISM.',
    artefacts,
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const saved = /** @type {{ artefacts: Array<{ id: string; sha256: string }> }} */ (
    JSON.parse(await readFile(manifestPath, 'utf8'))
  );

  console.log('Framework source refresh complete.');
  console.log(`Manifest: ${manifestPath}`);
  for (const artefact of saved.artefacts) {
    console.log(`- ${artefact.id}: ${artefact.sha256}`);
  }
}

await main();

import assert from "node:assert/strict";
import { access, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const outputRoot = join(root, ".tmp", "web-release");
const explorerDist = join(root, "packages", "explorer", "dist");
const schemaRoot = join(root, "schemas", "explorer-bundle");

await assertReadable(join(root, "pspf-ecosystem.html"));
await assertReadable(join(explorerDist, "index.html"));
await assertDirectory(schemaRoot);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const ecosystemHtml = await readFile(join(root, "pspf-ecosystem.html"), "utf8");
await writeFile(join(outputRoot, "index.html"), ecosystemHtml, "utf8");
await writeFile(join(outputRoot, "pspf-ecosystem.html"), ecosystemHtml, "utf8");
await cp(explorerDist, join(outputRoot, "explorer"), { recursive: true });
await cp(schemaRoot, join(outputRoot, "schemas", "explorer-bundle"), { recursive: true });

await writeFile(
  join(outputRoot, ".htaccess"),
  [
    "Options All -Indexes",
    'Header always set X-Content-Type-Options "nosniff"',
    'Header always set Referrer-Policy "strict-origin-when-cross-origin"',
    'Header always set X-Frame-Options "DENY"',
    'Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"',
    "Header always set Content-Security-Policy \"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'\"",
    "",
    "<IfModule mod_rewrite.c>",
    "  RewriteEngine On",
    "  RewriteRule ^explorer$ /explorer/ [R=302,L]",
    "</IfModule>",
    ""
  ].join("\n"),
  "utf8"
);

console.log("ok web release staged at .tmp/web-release with root page, /explorer, and schemas");

async function assertReadable(path) {
  try {
    await readFile(path);
  } catch (error) {
    assert.fail(`${path} must exist before staging the web release: ${error.message}`);
  }
}

async function assertDirectory(path) {
  try {
    await access(path);
    const stats = await stat(path);
    assert.equal(stats.isDirectory(), true, `${path} must be a directory before staging the web release`);
  } catch (error) {
    assert.fail(`${path} must exist before staging the web release: ${error.message}`);
  }
}

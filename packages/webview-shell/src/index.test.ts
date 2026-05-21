import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  bannerHtml,
  commandButtonAcknowledgementScript,
  cspNonce,
  pill,
  shellHtml,
  tokensCss,
  versionPill
} from "./index.js";

test("tokensCss includes shared root tokens for every surface", () => {
  for (const surface of ["extension", "explorer", "marketing"] as const) {
    const css = tokensCss(surface);
    assert.match(css, /--pspf-radius:/);
    assert.match(css, /--pspf-text:/);
    assert.match(css, /--pspf-primary:/);
    assert.match(css, /\.pspf-pill\b/);
    assert.match(css, /\.pspf-button\b/);
    assert.match(css, /\.pspf-banner\b/);
    assert.match(css, /\.pspf-empty\b/);
    assert.match(css, /\.pspf-table\b/);
    assert.match(css, /\.pspf-section\b/);
    assert.match(css, /pspf-skip-link/);
  }
});

test("tokensCss marketing surface declares an explicit dark-scheme palette", () => {
  const css = tokensCss("marketing");
  assert.match(css, /prefers-color-scheme:\s*dark/);
});

test("tokensCss extension surface does NOT hardcode marketing colours", () => {
  const css = tokensCss("extension");
  assert.equal(css.includes("prefers-color-scheme"), false);
});

test("button acknowledgement waits before showing busy state", () => {
  assert.match(commandButtonAcknowledgementScript, /setTimeout\(\(\) => \{/);
  assert.match(commandButtonAcknowledgementScript, /\}, 450\);/);
  assert.match(commandButtonAcknowledgementScript, /\}, 1400\);/);
});

test("button busy spinner renders as an inline indicator", () => {
  const css = tokensCss("extension");
  assert.match(css, /button\[aria-busy="true"\]::after[\s\S]*display: inline-block;/);
  assert.match(css, /button\[aria-busy="true"\]::after[\s\S]*margin-left: var\(--pspf-gap-sm\);/);
});

test("shellHtml returns a full HTML document with required structure", () => {
  const html = shellHtml({
    surface: "extension",
    title: "Workshop",
    body: "<p>Hello</p>"
  });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<html lang="en-AU">/);
  assert.match(html, /<title>Workshop<\/title>/);
  assert.match(html, /<style>[\s\S]*--pspf-radius:/);
  assert.match(html, /<main id="pspf-main">/);
  assert.match(html, /<p>Hello<\/p>/);
  assert.match(html, /Skip to main content/);
});

test("shellHtml defaults to relaxed CSP (no meta tag emitted)", () => {
  const html = shellHtml({ surface: "extension", title: "x", body: "" });
  assert.equal(html.includes("Content-Security-Policy"), false);
});

test("shellHtml strict CSP emits nonce and forbids inline script", () => {
  const html = shellHtml({
    surface: "extension",
    title: "x",
    body: "",
    csp: "strict",
    nonce: "abc123"
  });
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'nonce-abc123'/);
  assert.match(html, /default-src 'none'/);
});

test("shellHtml strict CSP throws without a nonce", () => {
  assert.throws(() => shellHtml({ surface: "extension", title: "x", body: "", csp: "strict" }), /requires a nonce/);
});

test("shellHtml renders an optional sensitivity banner with HTML-escaped text", () => {
  const html = shellHtml({
    surface: "extension",
    title: "x",
    body: "",
    sensitivityBanner: "OFFICIAL: Sensitive <draft>"
  });
  assert.match(html, /class="pspf-sensitivity-banner"/);
  assert.match(html, /OFFICIAL: Sensitive &lt;draft&gt;/);
});

test("shellHtml escapes the document title to defend against accidental injection", () => {
  const html = shellHtml({
    surface: "extension",
    title: "<script>evil()</script>",
    body: ""
  });
  assert.match(html, /<title>&lt;script&gt;evil\(\)&lt;\/script&gt;<\/title>/);
});

test("shellHtml extraHead is inserted into <head>", () => {
  const html = shellHtml({
    surface: "extension",
    title: "x",
    body: "",
    extraHead: '<meta name="role" content="diagnostic">'
  });
  assert.match(html, /<meta name="role" content="diagnostic">/);
});

test("versionPill renders accessible markup with the version prefix", () => {
  assert.equal(versionPill("1.24.0"), '<span class="pspf-pill">v1.24.0</span>');
  assert.equal(versionPill("1.24.0", "accent"), '<span class="pspf-pill pspf-pill--accent">v1.24.0</span>');
});

test("versionPill escapes special characters in the version string", () => {
  const html = versionPill("<bad>");
  assert.match(html, /v&lt;bad&gt;/);
});

test("pill renders generic labels without forcing a version prefix", () => {
  assert.equal(pill("Bundle baseline"), '<span class="pspf-pill">Bundle baseline</span>');
  assert.equal(pill("Local changes", "primary"), '<span class="pspf-pill pspf-pill--primary">Local changes</span>');
});

test("pill escapes special characters in labels", () => {
  assert.equal(pill('<draft "x">'), '<span class="pspf-pill">&lt;draft "x"&gt;</span>');
});

test("bannerHtml renders escaped note and status variants", () => {
  assert.equal(
    bannerHtml("OFFICIAL: Sensitive <draft>", "warn"),
    '<div class="pspf-banner pspf-banner--warn" role="note">OFFICIAL: Sensitive &lt;draft&gt;</div>'
  );
});

test("bannerHtml escapes the role attribute", () => {
  assert.equal(
    bannerHtml("Alert", "danger", 'alert" bad="x'),
    '<div class="pspf-banner pspf-banner--danger" role="alert&quot; bad=&quot;x">Alert</div>'
  );
});

test("cspNonce returns a base64url-safe string of expected length", () => {
  const a = cspNonce();
  const b = cspNonce();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  // 16 bytes => 22 base64url chars (no padding)
  assert.equal(a.length, 22);
});

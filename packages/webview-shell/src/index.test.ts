import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  attentionListHtml,
  bannerHtml,
  commandButtonAcknowledgementScript,
  cspNonce,
  decodePresentationLens,
  disclosureHtml,
  encodePresentationLens,
  homePanelShellHtml,
  lensSelectorHtml,
  metricStripHtml,
  pageHeaderHtml,
  pill,
  relationshipManagerHtml,
  shellHtml,
  traceChainHtml,
  trustChipsHtml,
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
    assert.match(css, /\.pspf-relationship-actions\b/);
    assert.match(css, /pspf-skip-link/);
  }
});

test("relationshipManagerHtml renders escaped relationship actions", () => {
  const html = relationshipManagerHtml({
    title: "Relationships <draft>",
    description: "Add links safely.",
    actions: [
      {
        label: "Link supplier",
        fromLabel: "Supplier <A>",
        phrase: "supports",
        toLabel: "Requirement & Risk",
        helpText: "Shows why this supplier matters <now>.",
        href: "command:pspf.shop.link?x=1&y=2"
      },
      {
        label: "No target",
        fromLabel: "Contract",
        phrase: "funds",
        toLabel: "Spend item",
        disabledReason: "All linked"
      }
    ]
  });

  assert.match(html, /Relationships &lt;draft&gt;/);
  assert.match(html, /Supplier &lt;A&gt;/);
  assert.match(html, /Requirement &amp; Risk/);
  assert.match(html, /Shows why this supplier matters &lt;now&gt;\./);
  assert.match(html, /command:pspf.shop.link\?x=1&amp;y=2/);
  assert.match(html, /All linked/);
});

test("relationshipManagerHtml renders escaped command-button actions", () => {
  const html = relationshipManagerHtml({
    title: "Relationships",
    actions: [
      {
        label: "Link existing <evidence>",
        fromLabel: "Requirement",
        phrase: "supported by",
        toLabel: "Evidence",
        command: 'linkExistingEvidenceToRequirement"bad',
        dataAttributes: {
          "data-requirement-id": 'req-1"x',
          onclick: "ignored"
        }
      }
    ]
  });

  assert.match(html, /<button type="button"/);
  assert.match(html, /data-command="linkExistingEvidenceToRequirement&quot;bad"/);
  assert.match(html, /data-requirement-id="req-1&quot;x"/);
  assert.doesNotMatch(html, /onclick/);
  assert.match(html, /Link existing &lt;evidence&gt;/);
});

test("relationshipManagerHtml renders an empty state", () => {
  const html = relationshipManagerHtml({ title: "Relationships", actions: [], emptyText: "Nothing to link." });

  assert.match(html, /class="pspf-empty"/);
  assert.match(html, /Nothing to link\./);
});

test("tokensCss marketing surface declares an explicit dark-scheme palette", () => {
  const css = tokensCss("marketing");
  assert.match(css, /prefers-color-scheme:\s*dark/);
});

test("tokensCss extension surface does NOT hardcode marketing colours", () => {
  const css = tokensCss("extension");
  assert.equal(css.includes("prefers-color-scheme"), false);
});

test("home panels expose all v1.50 product identities with theme-aware accents", () => {
  const expectedColours = {
    core: ["#536b70", "#91a7aa"],
    assurance: ["#625b8f", "#aaa4d4"],
    workshop: ["#176f68", "#62b8ae"],
    shop: ["#986329", "#d5a466"],
    pub: ["#825467", "#c58da5"],
    explorer: ["#3e6582", "#82acc8"]
  } as const;

  for (const [product, colours] of Object.entries(expectedColours)) {
    const html = homePanelShellHtml({
      product: product as keyof typeof expectedColours,
      extensionLabel: `PSPF ${product}`,
      title: product,
      tagline: "Local-first",
      version: "1.51.0",
      sensitivityBanner: "OFFICIAL: Sensitive",
      body: ""
    });
    assert.match(html, new RegExp(`--pspf-home-accent-light: ${colours[0]}`));
    assert.match(html, new RegExp(`--pspf-home-accent-dark: ${colours[1]}`));
    assert.match(html, /--pspf-home-accent-soft: color-mix/);
    assert.match(html, /body\.vscode-light,[\s\S]*body\.vscode-high-contrast-light/);
  }
});

test("presentation lenses decode malformed values to the neutral CISO view", () => {
  assert.equal(decodePresentationLens(undefined), "ciso");
  assert.equal(decodePresentationLens("bad"), "ciso");
  assert.equal(decodePresentationLens("auditor"), "auditor");
  assert.equal(encodePresentationLens("solo"), "solo");
});

test("v1.50 page primitives escape text and preserve supplied safe action markup", () => {
  assert.match(pageHeaderHtml({ eyebrow: "A < B", title: "Posture & work", description: "Review > act" }), /A &lt; B/);
  assert.match(trustChipsHtml([{ label: "OFFICIAL: Sensitive", strong: true }]), /pspf-trust-chip--strong/);
  assert.match(metricStripHtml([{ label: "Ready", value: 31, detail: "of 40" }]), /<strong>31<\/strong>/);
  assert.match(
    attentionListHtml([
      { title: "Evidence <old>", detail: "43 days", tone: "warning", actionHtml: "<button>Open</button>" }
    ]),
    /Evidence &lt;old&gt;[\s\S]*<button>Open<\/button>/
  );
  assert.match(
    traceChainHtml([{ marker: "RQ", title: "Requirement", detail: "supported by evidence" }]),
    /pspf-trace-chain__marker/
  );
  assert.match(
    disclosureHtml({ summary: "Advanced <tools>", bodyHtml: "<p>Body</p>", open: true }),
    /<details[^>]* open>/
  );
});

test("lens selector renders every presentation lens and selected state", () => {
  const html = lensSelectorHtml({ lens: "auditor", command: 'choose"lens' });
  assert.match(html, /value="ciso"/);
  assert.match(html, /value="auditor" selected/);
  assert.match(html, /value="solo"/);
  assert.match(html, /data-command="choose&quot;lens"/);
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

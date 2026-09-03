// Slice R4 (ADR 0097): operator narratives reused by the posture brief, magazine, and master plan.
import assert from "node:assert/strict";
import test from "node:test";
import type { NarrativeEntity, RequirementEntity } from "@pspf/contracts";
import { PSPF_DOMAINS } from "@pspf/contracts";
import {
  buildCisoMagazineModel,
  buildCisoMasterPlanModel,
  renderCisoMagazineHtml,
  renderCisoMagazineMarkdown,
  renderCisoMasterPlanMarkdown,
  renderPostureBriefMarkdown,
  resolveOperatorNotes,
  type PostureBriefInput
} from "./index.js";

const STAMP = "2026-08-01T00:00:00.000Z";
const RESTRICTED_TOKENS = ["Internal working note", "person@example.gov.au", "Person Name", "PER-0001"];

test("resolveOperatorNotes keeps the latest active record per slot and honours audience", () => {
  const first = narrative("NAR-1", "exec-brief.where-we-stand", "First.", { updatedAt: "2026-08-01T00:00:00.000Z" });
  const second = narrative("NAR-2", "exec-brief.where-we-stand", "Second.", {
    updatedAt: "2026-08-05T00:00:00.000Z",
    supersedesId: "NAR-1"
  });
  const internal = narrative("NAR-3", "exec-brief.what-changed", "Internal only.", { audience: "internal" });
  const blank = narrative("NAR-4", "exec-brief.decisions-needed", "   ");

  const all = resolveOperatorNotes([first, second, internal, blank]);
  assert.deepEqual([...all.keys()], ["exec-brief.what-changed", "exec-brief.where-we-stand"]);
  assert.deepEqual(all.get("exec-brief.where-we-stand"), {
    narrativeId: "NAR-2",
    body: "Second.",
    updatedAt: "2026-08-05T00:00:00.000Z",
    supersedesId: "NAR-1"
  });

  const executive = resolveOperatorNotes([first, second, internal, blank], { audience: "executive" });
  assert.deepEqual([...executive.keys()], ["exec-brief.where-we-stand"]);
  assert.deepEqual(
    resolveOperatorNotes([first, second, internal]),
    resolveOperatorNotes([first, second, internal]),
    "deterministic"
  );
});

test("posture brief without notes emits no operator sections", () => {
  const brief = renderPostureBriefMarkdown(briefFixture());

  assert.doesNotMatch(brief, /## Where We Stand/);
  assert.doesNotMatch(brief, /## What Changed/);
  assert.doesNotMatch(brief, /_Operator note_/);
  assert.match(brief, /^OFFICIAL: Sensitive\n/);
  assert.match(brief, /## Evidence Basis/);
  assert.equal(brief, renderPostureBriefMarkdown({ ...briefFixture(), narratives: [] }));
});

test("posture brief inserts Where We Stand and What Changed after the summary", () => {
  const brief = renderPostureBriefMarkdown({
    ...briefFixture(),
    narratives: [
      narrative("NAR-1", "exec-brief.where-we-stand", "We hold the line on governance."),
      narrative("NAR-2", "exec-brief.what-changed", "Two gaps closed since the last period.")
    ]
  });
  const lines = brief.split("\n");
  const summary = lines.indexOf("## Summary");
  const stand = lines.indexOf("## Where We Stand");
  const changed = lines.indexOf("## What Changed");
  const why = lines.indexOf("## Why This Matters");

  assert.ok(summary < stand && stand < changed && changed < why, "sections are ordered after the summary");
  assert.deepEqual(lines.slice(stand, stand + 6), [
    "## Where We Stand",
    "",
    "_Operator note_",
    "",
    "We hold the line on governance.",
    ""
  ]);
  assert.deepEqual(lines.slice(changed, changed + 6), [
    "## What Changed",
    "",
    "_Operator note_",
    "",
    "Two gaps closed since the last period.",
    ""
  ]);
  assert.match(brief, /^OFFICIAL: Sensitive\n/);
  assert.match(brief, /## Evidence Basis/);
});

test("posture brief ignores superseded and internal-audience notes", () => {
  const superseded = narrative("NAR-1", "exec-brief.where-we-stand", "Old draft.", {
    updatedAt: "2026-08-01T00:00:00.000Z"
  });
  const current = narrative("NAR-2", "exec-brief.where-we-stand", "Current note.", {
    updatedAt: "2026-08-05T00:00:00.000Z",
    supersedesId: "NAR-1"
  });
  const internal = narrative("NAR-3", "exec-brief.what-changed", "Internal working note.", { audience: "internal" });
  const brief = renderPostureBriefMarkdown({ ...briefFixture(), narratives: [superseded, current, internal] });

  assert.match(brief, /Current note\./);
  assert.doesNotMatch(brief, /Old draft\./);
  assert.doesNotMatch(brief, /## What Changed/);
  assert.doesNotMatch(brief, /Internal working note\./);
});

test("magazine editor note precedence: override, then operator note, then generated", () => {
  const note = narrative("NAR-1", "exec-brief.where-we-stand", "Operator's standing note.");
  const fixture = briefFixture();

  const generated = buildCisoMagazineModel(fixture);
  assert.equal(generated.editorNoteSource, "generated");
  assert.match(generated.editorNote, /summarised from current PSPF records/);

  const fromNote = buildCisoMagazineModel({ ...fixture, narratives: [note] });
  assert.equal(fromNote.editorNoteSource, "operator-note");
  assert.equal(fromNote.editorNote, "Operator's standing note.");

  const overridden = buildCisoMagazineModel({ ...fixture, narratives: [note], editorNoteOverride: " Override text. " });
  assert.equal(overridden.editorNoteSource, "operator-override");
  assert.equal(overridden.editorNote, "Override text.");

  const internalOnly = buildCisoMagazineModel({
    ...fixture,
    narratives: [narrative("NAR-2", "exec-brief.where-we-stand", "Internal only.", { audience: "internal" })]
  });
  assert.equal(internalOnly.editorNoteSource, "generated");
});

test("magazine renderers print the attribution only for an operator note", () => {
  const note = narrative("NAR-1", "exec-brief.where-we-stand", "Operator's standing note.");
  const fixture = briefFixture();

  const markdown = renderCisoMagazineMarkdown({ ...fixture, narratives: [note] });
  const lines = markdown.split("\n");
  const heading = lines.indexOf("## Editor's Note");
  assert.deepEqual(lines.slice(heading, heading + 6), [
    "## Editor's Note",
    "",
    "Operator's standing note.",
    "",
    "_Operator note_",
    ""
  ]);
  assert.match(markdown, /## Why This Matters/);
  assert.match(markdown, /## Attention Required/);

  const html = renderCisoMagazineHtml({ ...fixture, narratives: [note] });
  assert.match(html, /Operator's standing note\.<\/p><p class="meta">Operator note<\/p>/);

  assert.doesNotMatch(renderCisoMagazineMarkdown(fixture), /_Operator note_/);
  assert.doesNotMatch(renderCisoMagazineHtml(fixture), /Operator note</);
  assert.doesNotMatch(
    renderCisoMagazineMarkdown({ ...fixture, narratives: [note], editorNoteOverride: "Override." }),
    /_Operator note_/
  );
});

test("master plan carries the decisions-needed note as operator narrative", () => {
  const fixture = briefFixture();
  const without = buildCisoMasterPlanModel(fixture);
  assert.equal(without.operatorNarrative, undefined);
  assert.equal("operatorNarrative" in without, false);
  assert.doesNotMatch(renderCisoMasterPlanMarkdown(fixture), /## Operator narrative/);

  const withNote = {
    ...fixture,
    narratives: [
      narrative("NAR-1", "exec-brief.decisions-needed", "Decide whether to fund the patching uplift this quarter."),
      narrative("NAR-2", "exec-brief.decisions-needed", "Internal working note.", { audience: "internal" })
    ]
  };
  assert.equal(
    buildCisoMasterPlanModel(withNote).operatorNarrative,
    "Decide whether to fund the patching uplift this quarter."
  );
  const markdown = renderCisoMasterPlanMarkdown(withNote);
  const lines = markdown.split("\n");
  const heading = lines.indexOf("## Operator narrative");
  assert.ok(heading > lines.indexOf("# CISO Master Plan"));
  assert.ok(heading < lines.indexOf("## Direction"));
  assert.deepEqual(lines.slice(heading, heading + 4), [
    "## Operator narrative",
    "",
    "Decide whether to fund the patching uplift this quarter.",
    ""
  ]);
  assert.doesNotMatch(markdown, /Internal working note/);

  const magazine = buildCisoMagazineModel({ ...withNote, edition: "ciso" });
  assert.equal(magazine.masterPlan?.operatorNarrative, "Decide whether to fund the patching uplift this quarter.");
});

test("restricted tokens never reach the rendered outputs", () => {
  const fixture = {
    ...briefFixture(),
    narratives: [
      narrative("NAR-1", "exec-brief.where-we-stand", "Executive note."),
      narrative("NAR-2", "exec-brief.what-changed", "Executive change note."),
      narrative("NAR-3", "exec-brief.decisions-needed", "Executive decision note."),
      narrative("NAR-4", "exec-brief.top-exposures", "Internal working note about Person Name.", {
        audience: "internal"
      })
    ]
  };
  const outputs = [
    renderPostureBriefMarkdown(fixture),
    renderCisoMagazineMarkdown(fixture),
    renderCisoMagazineHtml(fixture),
    renderCisoMasterPlanMarkdown(fixture)
  ];

  for (const output of outputs) {
    for (const token of RESTRICTED_TOKENS) {
      assert.equal(output.includes(token), false, `output leaked "${token}"`);
    }
  }
});

// --- Fixtures ------------------------------------------------------------------------------

function envelope<T extends string>(entityType: T, id: string) {
  return {
    id,
    entityType,
    schemaVersion: "1.16.0",
    createdAt: STAMP,
    updatedAt: STAMP,
    sourceProduct: "workshop" as const,
    recordStatus: "active" as const
  };
}

function narrative(id: string, slot: string, body: string, extra: Partial<NarrativeEntity> = {}): NarrativeEntity {
  return { ...envelope("narrative", id), title: slot, slot, body, audience: "executive", ...extra };
}

function briefFixture(): PostureBriefInput {
  const governance = PSPF_DOMAINS[0]!;
  const requirement: RequirementEntity = {
    ...envelope("requirement", "REQ-GOV-1"),
    title: "Validate governance reporting workflow",
    domainId: governance.id,
    assessmentStatus: "partially-met",
    summary: "Internal working note that must not be exported.",
    ownerTeam: "Governance Office"
  };
  return {
    generatedAt: "2026-09-01T00:00:00.000Z",
    requirements: [requirement],
    evidence: [],
    actions: [
      {
        ...envelope("action", "ACT-1"),
        title: "Confirm next governance review date",
        status: "todo",
        dueDate: "2026-10-01",
        effortBasis: "Internal working note on effort."
      }
    ],
    risks: [
      {
        ...envelope("risk", "RSK-1"),
        title: "Governance review evidence may become stale",
        status: "open",
        likelihood: 3,
        impact: 3
      }
    ],
    links: [
      {
        ...envelope("link", "LNK-1"),
        title: "addressed-by",
        linkType: "addressed-by",
        fromId: requirement.id,
        fromType: "requirement",
        toId: "ACT-1",
        toType: "action"
      },
      {
        ...envelope("link", "LNK-2"),
        title: "exposed-by",
        linkType: "exposed-by",
        fromId: requirement.id,
        fromType: "requirement",
        toId: "RSK-1",
        toType: "risk"
      }
    ],
    domains: PSPF_DOMAINS,
    sourceLabel: "Test"
  };
}

import assert from "node:assert/strict";
import test from "node:test";
import { PSPF_DOMAINS, withEnvelope } from "@pspf/contracts";
import { collectOwnerTeams } from "./owner-team.js";

test("collectOwnerTeams returns distinct trimmed teams from actions and requirements, sorted en-AU", () => {
  const entities = [
    withEnvelope(
      "action",
      { entityType: "action", title: "A", status: "todo", ownerTeam: "  Security Ops " },
      "workshop"
    ),
    withEnvelope("action", { entityType: "action", title: "B", status: "todo", ownerTeam: "security ops" }, "workshop"),
    withEnvelope("action", { entityType: "action", title: "C", status: "todo", ownerTeam: "   " }, "workshop"),
    withEnvelope("action", { entityType: "action", title: "D", status: "todo" }, "workshop"),
    withEnvelope(
      "requirement",
      {
        entityType: "requirement",
        title: "R",
        domainId: PSPF_DOMAINS[0]!.id,
        assessmentStatus: "met",
        ownerTeam: "Architecture"
      },
      "workshop"
    ),
    {
      ...withEnvelope(
        "requirement",
        {
          entityType: "requirement",
          title: "Deleted",
          domainId: PSPF_DOMAINS[0]!.id,
          assessmentStatus: "met",
          ownerTeam: "Retired Team"
        },
        "workshop"
      ),
      recordStatus: "deleted" as const
    },
    withEnvelope(
      "risk",
      { entityType: "risk", title: "Not a team source", status: "open", likelihood: 1, impact: 1 },
      "workshop"
    )
  ];

  assert.deepEqual(collectOwnerTeams(entities), ["Architecture", "Security Ops"]);
  assert.deepEqual(collectOwnerTeams([]), []);
});

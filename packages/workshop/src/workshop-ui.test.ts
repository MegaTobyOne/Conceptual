import test from "node:test";
import assert from "node:assert/strict";
import { formatShortAuDateTime, normaliseShortAuDateTime, shortWorkshopPanelTitle } from "./workshop-ui.js";

test("requirement editor tabs use the requirement number instead of the full title", () => {
    const title = shortWorkshopPanelTitle({
        entityType: "requirement",
        id: "REQ-00000000-0000-4000-8000-000000000801",
        title: "17 Validate governance reporting workflow"
    });

    assert.equal(title, "Requirement 17");
});

test("other edit tabs use compact type and id labels", () => {
    assert.equal(shortWorkshopPanelTitle({ entityType: "action", id: "ACT-00000000-0000-4000-8000-000000000801", title: "Confirm next governance review date" }), "Action ACT-0801");
    assert.equal(shortWorkshopPanelTitle({ entityType: "evidence", id: "EVD-00000000-0000-4000-8000-000000000802", title: "A very long evidence title" }), "Evidence EVD-0802");
    assert.equal(shortWorkshopPanelTitle({ entityType: "direction", id: "DIR-00000000-0000-4000-8000-000000000803", title: "Long direction title", reference: "HA-DIR-2026-01" }), "Direction HA-DIR-2026-01");
});

test("due dates render as short AU dates without raw ISO noise", () => {
    assert.equal(formatShortAuDateTime("2026-06-30T00:00:00.000Z"), "30 Jun 2026");
    assert.equal(normaliseShortAuDateTime("30/06/2026"), "30 Jun 2026");
    assert.equal(normaliseShortAuDateTime("30 Jun 2026"), "30 Jun 2026");
    assert.equal(normaliseShortAuDateTime("today", new Date(2026, 4, 19, 15, 45)), "19 May 2026");
});
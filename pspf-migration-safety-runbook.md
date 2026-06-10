# PSPF Migration Safety Runbook

Status: **aspirational**

## Purpose

This runbook defines how schema migrations are classified, approved, executed, and recovered in PSPF v1.

## Migration policy for v1

1. **No migration runs automatically.** Every migration \u2014 even an additive one \u2014 requires an explicit operator command (`pspf.core.runMigration`) issued from a trusted workspace.\n2. Migrations are still **classified** as safe or non-safe; the class controls the pre-flight prompts and the requirement for explicit operator confirmation, not whether the migration runs.\n3. Every migration run must create a recovery reference before applying changes.\n4. Until the operator runs migrations, Core opens the workspace in **degraded read-only mode** with a clear health-view diagnostic explaining why and what to do next.

## Migration classes

### Safe migration

A migration is safe only if all are true:

1. Additive schema change only.
2. No destructive drop/rename of existing columns or tables.
3. Existing records remain valid without data loss.
4. Roll-forward does not require irreversible transformation.

### Non-safe migration

A migration is non-safe if any are true:

1. Drops or renames columns/tables.
2. Rewrites or compacts historical data.
3. Changes required semantics of existing fields.
4. Requires backfill with non-trivial transformation logic.

## Required pre-flight checks

Before applying any migration:

1. Confirm workspace trust is enabled.
2. Confirm no conflicting write operation is active.
3. Create backup using backup runbook procedure.
4. Verify backup integrity.
5. Record current schema version and migration target version.

## Migration execution record

Each run should record:

- migration run id,
- start and end timestamps,
- source and target schema versions,
- migration class,
- backup reference,
- applied steps,
- warnings and errors,
- final result.

## Failure handling

If migration fails:

1. Stop migration pipeline and mark workspace state as degraded.
2. Do not auto-retry non-safe migrations.
3. Offer guided restore using last verified backup.
4. Emit structured diagnostic codes for root cause and next steps.

## Recovery path

Standard recovery order:

1. Attempt controlled roll-forward if migration supports idempotent retry and integrity checks pass.
2. If roll-forward is unsafe or fails, restore from pre-migration backup.
3. Re-run validation and integrity checks.
4. Block dependent product write operations until compatibility is restored.

## Acceptance checks after migration

1. Schema version reflects target version.
2. Integrity checks pass.
3. Contract tests for affected entities and links pass.
4. Core health reports compatible state.
5. Workshop, Shop, and Pub can read required entities.

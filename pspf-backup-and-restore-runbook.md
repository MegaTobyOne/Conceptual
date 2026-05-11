# PSPF Backup and Restore Runbook

## Purpose

This runbook defines the operational procedure for backing up and restoring the PSPF Core workspace data store and associated platform metadata. It is written for a local-first PSPF environment using SQLite as the system of record, with PSPF Core and PSPF Workshop running in Visual Studio Code, and PSPF Explorer consuming exported JSON bundles separately. SQLite provides a built-in backup mechanism for creating consistent copies of a database, and `PRAGMA integrity_check` is the standard low-level consistency check for validating a SQLite database file.

This runbook also aligns with general Australian cyber guidance that backups should be performed regularly, secured appropriately, and tested by restoring them periodically. Cyber.gov.au specifically recommends regular backups, protecting backup locations, and checking that backups can actually be restored.

## Scope

This runbook covers:

- backup of the PSPF Core SQLite database,
- backup of associated PSPF workspace metadata,
- restore of the Core SQLite database,
- post-restore validation,
- backup verification,
- and minimum retention and security practices for local and off-site copies.

This runbook does **not** cover Explorer static site deployment rollback, extension Marketplace rollback, or data migration rollback. Those belong in separate release and migration runbooks.

## System assumptions

This runbook assumes the PSPF workspace uses a structure similar to:

```text
<workspace>/
  .pspf/
      core/
         pspf-core.db
         migrations/
         journal/
         locks/
      config/
         workspace.json
         products.json
         policies.json
      logs/
      exchange/
         exports/
         snapshots/
```

The exact filenames can vary, but the critical restore unit is the SQLite database plus any adjacent PSPF configuration and metadata required for Core to reopen the workspace correctly.

## Roles and ownership

For a single-operator environment, the operator performing the backup is also responsible for confirming backup validity and recording the result. In a multi-person environment, the backup operator and restore approver should be separated where practical, especially for destructive restore actions. This supports stronger backup governance and reduces the risk of accidental or malicious destruction of backup data.

## Backup policy

### Minimum expectations

The minimum operational standard is:

- one automated local backup at least daily,
- one offline or removable backup copy updated regularly,
- one off-device or off-site protected copy for recovery from device loss or ransomware,
- and a tested restore at least quarterly.

Cyber.gov.au recommends regular backups, suggests using automatic backups where possible, and stresses testing restores to confirm that backups actually work. It also notes that backups should be secured and that cloud backup accounts should be protected with strong credentials and multi-factor authentication.

### Recommended retention

Suggested baseline retention:

- daily backups for 14 days,
- weekly backups for 8 weeks,
- monthly backups for 12 months,
- pre-migration and pre-release backups retained until the next known-good checkpoint.

## Backup locations

Recommended backup destinations:

1. **Local backup directory** for quick recovery, for example:
   - `~/Backups/pspf/`
2. **Removable/offline storage** for ransomware resilience.
3. **Encrypted cloud or off-site location** for loss-of-device scenarios.

Cyber.gov.au recommends considering both cloud and external storage, and notes that cloud backup services may preserve recoverable older versions while simple sync-style cloud storage may not be sufficient on its own in a ransomware scenario. It also recommends protecting backups with strong authentication and storing physical media securely.

## Naming convention

Use timestamped backup names in UTC or a consistent local timezone format.

Recommended format:

```text
core-YYYYMMDD-HHMMSS.db
workspace-meta-YYYYMMDD-HHMMSS.tar.gz
```

Example:

```text
core-20260509-113000.db
workspace-meta-20260509-113000.tar.gz
```

## Preconditions

Before running a manual backup or restore:

- confirm the workspace path,
- confirm sufficient free disk space,
- confirm the backup destination exists,
- confirm no unrelated filesystem cleanup job is targeting the backup directory,
- and confirm whether VS Code should be closed or whether an online backup will be used.

## Backup methods

### Method A — preferred live backup with SQLite `.backup`

SQLite’s backup API is the recommended mechanism for creating a consistent copy of a live database, and the SQLite CLI exposes this via the `.backup` command.

Use this method when PSPF Core may still be running, provided the workspace is not under heavy write activity.

#### Command

```bash
mkdir -p ~/Backups/pspf
sqlite3 .pspf/core/pspf-core.db ".backup '~/Backups/pspf/core-$(date +%Y%m%d-%H%M%S).db'"
```

#### Notes

- This creates a transactionally consistent snapshot copy of the database.
- A live backup is safer than a raw file copy when the database may be open.
- If PSPF Core is writing continuously, schedule a quiet period before running the backup.

### Method B — cold file copy

Use this only when VS Code is closed or the PSPF extensions are fully inactive.

#### Important: WAL and SHM files are part of the database

Core runs SQLite in WAL mode (`journal_mode=WAL`). When the database is open or has uncheckpointed changes, the live database state is split across three files:

- `pspf-core.db` — main database file
- `pspf-core.db-wal` — write-ahead log
- `pspf-core.db-shm` — shared-memory index

A cold file copy MUST copy all three files together as one atomic unit, or the resulting backup may be inconsistent or unreadable. Prefer Method A whenever Core may have run; only use Method B after Core has been cleanly closed and a checkpoint has been performed.

To force a checkpoint before a cold copy:

```bash
sqlite3 .pspf/core/pspf-core.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

After a successful checkpoint, `pspf-core.db-wal` should be empty (or absent on the next open). Method A (`.backup`) handles WAL transparently and is always preferred for routine backups.

#### Command

```bash
mkdir -p ~/Backups/pspf
TS=$(date +%Y%m%d-%H%M%S)
cp .pspf/core/pspf-core.db     ~/Backups/pspf/core-$TS.db
cp .pspf/core/pspf-core.db-wal ~/Backups/pspf/core-$TS.db-wal 2>/dev/null || true
cp .pspf/core/pspf-core.db-shm ~/Backups/pspf/core-$TS.db-shm 2>/dev/null || true
```

#### Notes

A raw copy is simple, but it is safest when the database is definitely not being written to and a WAL checkpoint has been performed. Practical SQLite guidance consistently treats `.backup` as the more reliable transactional method for active databases.

### Method C — SQL dump backup

Use this as a secondary portability backup, not the primary operational restore copy.

#### Command

```bash
mkdir -p ~/Backups/pspf
sqlite3 .pspf/core/pspf-core.db .dump > ~/Backups/pspf/core-$(date +%Y%m%d-%H%M%S).sql
```

#### Notes

A `.dump` backup is useful for inspection and some recovery scenarios, but for routine restore speed and fidelity, a `.db` backup is the preferred operational artefact.

## Metadata backup

In addition to the database, create a compressed backup of the adjacent PSPF metadata needed to reopen the workspace consistently.

### Command

```bash
mkdir -p ~/Backups/pspf
TS=$(date +%Y%m%d-%H%M%S)
tar -czf ~/Backups/pspf/workspace-meta-$TS.tar.gz .pspf/config .pspf/logs .pspf/exchange/exports .pspf/exchange/snapshots 2>/dev/null || true
```

### Notes

Do not assume logs and exports are authoritative, but keep them because they can help with diagnostics, traceability, and reconstruction after a restore.

## Backup verification

### Immediate verification

After every database backup, validate the copied file using SQLite integrity checking.

#### Command

```bash
sqlite3 ~/Backups/pspf/core-YYYYMMDD-HHMMSS.db "PRAGMA integrity_check;"
```

`PRAGMA integrity_check` returns `ok` when no structural issues are found. SQLite documents that this check detects low-level formatting and consistency problems such as missing pages, malformed records, and index inconsistencies.

### Optional metadata verification

Check that the metadata archive exists and is readable.

#### Command

```bash
tar -tzf ~/Backups/pspf/workspace-meta-YYYYMMDD-HHMMSS.tar.gz > /dev/null
```

### Restore test cadence

At least quarterly, perform a full test restore to a temporary workspace. Cyber.gov.au explicitly recommends regularly trying to restore backups to confirm they work when needed.

## Manual backup procedure

### Steps

1. Open a terminal in the PSPF workspace root.
2. Confirm `.pspf/core/pspf-core.db` exists.
3. Create the backup directory if needed.
4. Run SQLite `.backup`.
5. Run `PRAGMA integrity_check` on the backup file.
6. Archive workspace metadata.
7. Record the backup result in the run log.
8. If required, sync the backup file to offline or off-site storage.

### Example end-to-end command block

```bash
set -euo pipefail
mkdir -p ~/Backups/pspf
TS=$(date +%Y%m%d-%H%M%S)
DB_BACKUP=~/Backups/pspf/core-$TS.db
META_BACKUP=~/Backups/pspf/workspace-meta-$TS.tar.gz

sqlite3 .pspf/core/pspf-core.db ".backup '$DB_BACKUP'"
sqlite3 "$DB_BACKUP" "PRAGMA integrity_check;"
tar -czf "$META_BACKUP" .pspf/config .pspf/logs .pspf/exchange/exports .pspf/exchange/snapshots 2>/dev/null || true

echo "$TS backup complete: $DB_BACKUP"
```

## Automated backup example

The following shell script is suitable for macOS, Linux, or WSL and can be scheduled with cron or a task scheduler.

```bash
#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="/path/to/workspace"
BACKUP_DIR="$HOME/Backups/pspf"
mkdir -p "$BACKUP_DIR"

cd "$WORKSPACE"
TS=$(date +%Y%m%d-%H%M%S)
DB_BACKUP="$BACKUP_DIR/core-$TS.db"
META_BACKUP="$BACKUP_DIR/workspace-meta-$TS.tar.gz"
LOG_FILE="$BACKUP_DIR/backup.log"

sqlite3 .pspf/core/pspf-core.db ".backup '$DB_BACKUP'"
CHECK_RESULT=$(sqlite3 "$DB_BACKUP" "PRAGMA integrity_check;")
if [[ "$CHECK_RESULT" != "ok" ]]; then
  echo "$TS integrity check failed for $DB_BACKUP: $CHECK_RESULT" >> "$LOG_FILE"
  exit 1
fi

tar -czf "$META_BACKUP" .pspf/config .pspf/logs .pspf/exchange/exports .pspf/exchange/snapshots 2>/dev/null || true

echo "$TS success $DB_BACKUP" >> "$LOG_FILE"
```

## Restore policy

Restore is a controlled action because it can overwrite the current operational database. Always preserve the current database before replacing it, even if it appears damaged.

## Restore procedure

### Preconditions

Before restore:

- stop VS Code or disable PSPF extensions,
- identify the exact backup file to restore,
- confirm the backup passed integrity verification,
- and confirm the operator understands that recent changes after the backup timestamp will be lost unless separately captured.

### Standard restore steps

1. Open a terminal in the workspace root.
2. Make a safety copy of the current `.pspf/core/pspf-core.db`.
3. Copy the selected backup into place.
4. Run `PRAGMA integrity_check` on the restored file.
5. Restore metadata archive if required.
6. Start VS Code.
7. Run PSPF Core validation and integrity commands.
8. Confirm key records are visible in Workshop.

### Commands

```bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE=~/Backups/pspf/core-YYYYMMDD-HHMMSS.db

mv .pspf/core/pspf-core.db .pspf/core/pspf-core.db.pre-restore-$TS
cp "$BACKUP_FILE" .pspf/core/pspf-core.db
sqlite3 .pspf/core/pspf-core.db "PRAGMA integrity_check;"
```

### Optional metadata restore

Only restore metadata archives if the workspace config or auxiliary PSPF directories are also damaged or missing.

```bash
tar -xzf ~/Backups/pspf/workspace-meta-YYYYMMDD-HHMMSS.tar.gz
```

## Post-restore validation

After a restore:

1. Run SQLite integrity check again:
   ```bash
   sqlite3 .pspf/core/pspf-core.db "PRAGMA integrity_check;"
   ```
2. Open VS Code.
3. Run `PSPF Core: Validate Workspace`.
4. Run `PSPF Core: Verify Integrity`.
5. Open PSPF Workshop and confirm:
   - requirements load,
   - evidence relationships appear,
   - actions and risks are present,
   - summary counts look reasonable.

SQLite documents that `PRAGMA integrity_check` validates the structural integrity of the file, but it does not detect every possible issue such as foreign-key logic problems unless those are checked separately. That is why Core-level validation must also be run after restore.

## Failed restore procedure

If the restored file fails validation:

1. Stop VS Code again.
2. Move failed restored file aside.
3. Revert to the pre-restore safety copy.
4. Try an older backup.
5. If no backup restores cleanly, move to the broader recovery runbook.

### Commands

```bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)

mv .pspf/core/pspf-core.db .pspf/core/pspf-core.db.failed-restore-$TS
mv .pspf/core/pspf-core.db.pre-restore-YYYYMMDD-HHMMSS .pspf/core/pspf-core.db
sqlite3 .pspf/core/pspf-core.db "PRAGMA integrity_check;"
```

## Security controls for backups

Backups can contain the same or greater sensitivity as the live workspace. Cyber.gov.au advises that backups should be secured, that cloud backups should use strong authentication and MFA, and that external backup devices should be kept physically secure.

Minimum controls:

- restrict filesystem permissions on backup directories,
- encrypt off-site or cloud-stored backups,
- use MFA on cloud backup accounts,
- disconnect removable backup media when not actively in use,
- and store offline copies separately from the main device.

Additional practical guidance also recommends keeping offline backups disconnected when not in use and physically protecting backup media.

## Retention cleanup example

Example cleanup command to delete local `.db` backups older than 30 days:

```bash
find ~/Backups/pspf -type f -name 'core-*.db' -mtime +30 -delete
```

Use cleanup only if another protected copy exists. Never automate deletion until restore testing is established.

## Run log template

Record each manual or automated run in a simple log.

```text
Timestamp:
Workspace:
Operator:
Action: backup | restore | test-restore
Database backup file:
Metadata backup file:
Integrity result:
Core validation result:
Notes:
```

## Quarterly test-restore procedure

1. Create a temporary test workspace.
2. Restore the latest backup into that workspace.
3. Run SQLite integrity check.
4. Open in VS Code.
5. Run Core validation and integrity checks.
6. Confirm at least one requirement, one evidence item, one action, and one report artefact are readable.
7. Record success or failure in the run log.

Cyber.gov.au recommends actually trying restores periodically, because backup confidence comes from tested recovery, not just from successful copy jobs.

## Failure triggers requiring escalation

Escalate to the broader recovery or migration runbook if any of the following occur:

- backup integrity check does not return `ok`,
- current database file fails `PRAGMA integrity_check`,
- two or more recent backups fail validation,
- restored workspace opens but Core validation fails materially,
- or backup media is suspected to be tampered with, encrypted, or unavailable.

## Specification summary

This runbook standardises PSPF backup and restore around SQLite’s transactional `.backup` capability, integrity verification with `PRAGMA integrity_check`, preservation of adjacent PSPF metadata, and regular restore testing. SQLite documents `.backup` and `integrity_check` as the right primitives for consistent copy and structural verification, while Cyber.gov.au recommends regular, secure, and tested backups as a core protective practice.

The operational rule is simple: back up regularly, verify immediately, keep at least one protected offline or off-site copy, and prove recoverability with real restore tests rather than assuming a copied file is good. That gives the PSPF platform a practical and defensible recovery baseline.

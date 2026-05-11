# PSPF Error and Diagnostics Model

## Purpose

This document defines a stable diagnostic model for API, storage, migration, import/export, and workflow validation behaviour.

## Diagnostic object contract

Every surfaced diagnostic should include:

- `code`: stable machine-readable identifier
- `severity`: `info`, `warning`, `error`, `critical`
- `category`: `api`, `storage`, `migration`, `integrity`, `validation`, `export`, `import`, `compatibility`, `security`
- `message`: short user-readable summary
- `context`: minimal safe metadata (entity id, operation id, schema version)
- `retryable`: boolean
- `recommendedAction`: explicit next step

## Code format

Use the format `PSPF_<CATEGORY>_<NAME>`.

Examples:

- `PSPF_STORAGE_DB_MISSING`
- `PSPF_MIGRATION_NOT_SAFE`
- `PSPF_COMPAT_API_MISMATCH`
- `PSPF_EXPORT_POLICY_BLOCKED`

## Minimum v1 code set

### Storage and integrity

- `PSPF_STORAGE_DB_MISSING`
- `PSPF_STORAGE_DB_CORRUPT`
- `PSPF_INTEGRITY_CHECK_FAILED`

### Migration

- `PSPF_MIGRATION_REQUIRED`
- `PSPF_MIGRATION_NOT_SAFE`
- `PSPF_MIGRATION_FAILED`

### API and compatibility

- `PSPF_COMPAT_API_MISMATCH`
- `PSPF_COMPAT_SCHEMA_MISMATCH`
- `PSPF_API_UNAUTHORIZED_CALLER`

### Import/export

- `PSPF_IMPORT_BUNDLE_INVALID`
- `PSPF_IMPORT_LIMIT_EXCEEDED`
- `PSPF_EXPORT_POLICY_BLOCKED`
- `PSPF_EXPORT_SCHEMA_UNSUPPORTED`
- `PSPF_EXPORT_PERSONAL_FIELD_LEAK` (CI-only; never user-surfaced; bundle would have leaked a `restricted` field)

### Validation

- `PSPF_VALIDATION_REQUIRED_LINK_MISSING`
- `PSPF_VALIDATION_STATE_INCONSISTENT`
- `PSPF_VALIDATION_LINKTYPE_UNKNOWN`
- `PSPF_VALIDATION_LINKTYPE_TRIPLE_INVALID`
- `PSPF_VALIDATION_FIELD_POLICY_MISSING`

### Privacy and erasure

- `PSPF_REDACTION_EVENT_RECORDED`
- `PSPF_PURGE_CONFIRMATION_REQUIRED`
- `PSPF_PURGE_COMPLETED`
- `PSPF_PURGE_DENIED_NOT_TRUSTED`

## Severity guidance

1. `info`: non-blocking state updates.
2. `warning`: recoverable issue requiring attention soon.
3. `error`: operation failed and user action is required.
4. `critical`: data safety or integrity risk; block sensitive operations.

## Retry guidance

1. Retry only when `retryable=true` and state is not integrity-critical.
2. Do not auto-retry destructive or migration operations.
3. Provide explicit operator guidance for non-retryable failures.

## Presentation guidance

1. User-facing text should be concise and non-bureaucratic.
2. Raw stack traces are hidden by default and available only in explicit technical details panels.
3. Sensitive fields in diagnostic context must be redacted using the security controls policy.

## Governance

1. Diagnostic code changes require update to this document and contract tests.
2. Deprecated codes should remain mappable for one minor release cycle.

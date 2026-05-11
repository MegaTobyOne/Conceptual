# 0011 — OFFICIAL: Sensitive — labelling-only protection in v1

- Status: accepted
- Date: 2026-05-09
- Related: ADR 0004 (Explorer dual-mode), `pspf-threat-model.md`, `explorer-screen-workflow-spec.md` § Sensitive-data protection posture

## Context

The standalone PSPF Explorer prototype displays an "OFFICIAL: Sensitive" plus TLP banner on every screen but applies no technical protection to user data: no encryption, no passphrase, no idle lock, no on-disk encryption of exported backups. The README and threat model treat this as a labelling commitment, with confidentiality of the underlying data delegated to the user's handling of the device and the exported file.

The Conceptual rewrite needs an explicit position: is the OFFICIAL: Sensitive marking a label, or is it a control?

The realistic v1 threats are: shoulder-surfing on a shared workstation; a laptop borrowed or stolen with the browser still open; a second OS-account user; a malicious browser extension; and (highest leverage) backup JSON files left on disk.

Plausible technical responses include:

- an **idle lock** that hides content after inactivity,
- **passphrase-encrypted IndexedDB** so an attacker with browser-profile access still needs the passphrase to read content,
- **passphrase-encrypted backups** so the file that leaves the device is the one that's protected,
- or any combination of these.

## Decision

In v1, OFFICIAL: Sensitive is a **labelling commitment, not a technical control**. Explorer:

- shows the marking on every screen of local-authoring mode (invariant E13);
- states the protection posture honestly on the Data / About screen and at export time (storage is unencrypted; there is no idle lock; backups are unencrypted; reset and site-data clear are irrecoverable);
- does **not** claim, in any spec, copy, or test, that data is encrypted at rest or that Explorer enforces a confidentiality control.

This is deliberate and provisional. The intent is to keep v1 small while the core authoring loops (Board, Requirement Detail, plan-then-apply imports, master-bundle round-trip) are validated against real use. Confidentiality controls will be revisited once those loops are stable.

## Reopening criteria

This ADR will be revisited and is expected to be superseded once **at least two** of the following hold:

1. The core authoring loops are stable and being used regularly.
2. A real-world incident or near-miss (lost laptop, exposed backup, shoulder-surf) shows the labelling-only posture is insufficient.
3. The deployment audience expands beyond the original single-user, single-device target.
4. A user explicitly asks for at-rest protection.

The likely future direction is **passphrase-encrypted IndexedDB** (option C in the original options list), optionally combined with passphrase-encrypted backup files. The successor ADR will specify the key-derivation function (Argon2id preferred), the unlock UX, the recovery story (irrecoverable on lost passphrase, by design), and how the experimental banner copy must change.

## Consequences

- v1 build cost is unchanged from the prototype's posture; no encryption library, no passphrase UI, no key-management code.
- Honest copy on Data / About and the export flow is required so users understand the v1 posture and handle backups appropriately.
- The threat model retains "local-data exposure on a shared device" as out-of-scope-for-v1, with this ADR as the citation.
- A future move to encryption will be a non-trivial migration. The migration runbook must address one-time encryption of existing IndexedDB content and backwards-compatibility with unencrypted v1 backups.

## Alternatives considered

- **B (idle lock).** Cheap, addresses shoulder-surfing only; defers but does not solve the lost-laptop and backup-on-disk threats. Reasonable to add later as a step toward C.
- **C (passphrase-encrypted IndexedDB).** Strongest realistic v1 control on a single-device tool. Rejected for v1 only on cost/timing grounds; named here as the expected future direction.
- **D (encrypted backups, plain store).** Targets the artefact that actually leaves the device. Lower cost than C; partial confidentiality. A reasonable interim step on the way to C.
- **E (B + D).** Combination of idle lock and encrypted backups. Reasonable interim; rejected for v1 on the same scope grounds as C.

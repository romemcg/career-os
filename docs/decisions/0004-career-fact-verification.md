# ADR 0004: Career facts are typed, sourced and verified by the owner

Status: accepted (Milestone 1)

## Decision

- A fact has a `fact_type` and `content_json` validated by a per-type Zod schema (`contentSchemaVersion` = 1). Unknown
  keys are stripped.
- New facts are always `unverified`, regardless of input.
- Verification requires a linked source (enforced in code and by a database CHECK). Rejection requires a reason.
- Editing a verified fact's content or source withdraws verification.
- Corrections to verified facts are made by creating a replacement that `supersedes` the original; the original becomes
  `superseded` only when the replacement is verified, so there is never a gap with no verified version.
- Every change writes an immutable `career_fact_revisions` row and an audit entry in the same transaction. Concurrent
  edits are serialised with `SELECT ... FOR UPDATE` plus a `revision` check (409 on mismatch).
- Metric values are stored as text exactly as evidenced to avoid rounding or unit reinterpretation.

## Consequences

Later AI features must read facts through `listVerifiedFacts()` and must not write `verified` status. Conflict detection
between facts (SCR-07) is not yet implemented.

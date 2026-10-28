# Milestone 1 report: Working Foundation (CAR-001 to CAR-008)

Date: 28 October 2026. Built and tested in a Linux cloud container, not on the target Mac (see
[environment assessment](architecture/environment-assessment.md)).

## Ticket status

| Ticket  | Scope                                        | Status | Evidence                                                                          |
| ------- | -------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| CAR-001 | Next.js app, TypeScript, lint, format, tests | Done   | `pnpm build`, `lint`, `typecheck`, `format:check` pass; CI workflow added         |
| CAR-002 | Tailwind, design tokens, responsive shell    | Done   | Light/dark tokens; sidebar + mobile nav; mobile e2e checks no horizontal overflow |
| CAR-003 | PostgreSQL + Prisma migrations               | Done   | 2 migrations apply cleanly with `migrate deploy` to a fresh DB                    |
| CAR-004 | Owner auth and sessions                      | Done   | Integration + e2e: login, lockout, expiry, logout, reset revokes sessions         |
| CAR-005 | Authorization and audit                      | Done   | Cross-owner tests return 404 and leave data untouched; audit rows per mutation    |
| CAR-006 | Private file storage                         | Done   | Upload, retrieve, checksum, tamper detection, delete tests                        |
| CAR-007 | Career facts and sources schema              | Done   | FKs, CHECK constraints and append-only triggers verified by tests                 |
| CAR-008 | Knowledge base and verification UI           | Done   | e2e: add source with file, add fact, verify, reject with reason, history          |

## Exit condition

| Condition                                            | Result                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| App starts                                           | `pnpm start` serves on 127.0.0.1:3001; `/api/health` ok                       |
| Owner authentication works                           | Yes (tests above)                                                             |
| Migrations apply                                     | Yes                                                                           |
| Facts created, reviewed, verified, edited, retrieved | Yes (integration + e2e)                                                       |
| Source provenance preserved                          | Sources, document SHA-256, per-revision `source_id`                           |
| Unauthorized access rejected                         | 401 without session; 404 for other owners' records; 403 cross-origin          |
| Data persists across restart                         | Manually verified: fact created, server stopped and restarted, fact read back |
| Tests pass                                           | See below                                                                     |
| Setup and recovery documented                        | README, runbooks                                                              |

## Tests executed (final run)

- Vitest: 12 files, 66 tests passed (unit 6 files, component 1, integration 5 against PostgreSQL 16).
- Playwright: 6 tests passed (5 desktop Chromium, 1 iPhone 13 viewport).
- Manual: backup, simulated data loss, restore and integrity verification; tampered backup refused.

## Known limitations

- Not yet run on macOS. launchd setup and Safari cookie behaviour are documented but untested.
- CV text extraction (CAR-009) is not implemented; uploaded CVs are stored as originals only.
- Fact conflict detection (SCR-07) and a structured data export (US-12) are not implemented.
- Search uses `ILIKE` over fact JSON; adequate for one owner, not full-text ranked.
- Login lockout is per account, not per IP; acceptable for loopback-only access.
- Prisma 7's transaction interpreter triggers a `pg` deprecation warning (ADR 0003). Harmless today.
- Accessibility: keyboard flows and labels are covered by e2e role/label queries; no automated WCAG audit yet.

## Next recommended ticket

**CAR-009: CV upload and extraction.** PDF/DOCX text extraction with a local parser, a preview, and proposed facts
created as `unverified` with the uploaded CV as their source. It builds directly on the storage and verification model
and needs no AI provider.

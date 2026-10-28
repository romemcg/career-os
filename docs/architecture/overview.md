# Architecture overview (Milestone 1)

Modular monolith: one Next.js application, one PostgreSQL database, one private data directory.

```
Browser ──► Next.js (127.0.0.1:3001)
             ├── src/proxy.ts               optimistic redirect when no session cookie
             ├── src/app/(workspace)/*      server components; requireOwner() then call services
             ├── src/app/api/v1/*           route handlers wrapped by authed()/publicRoute()
             │        └── same-origin check → session validation → Zod validation → service
             ├── src/modules/*/service.ts   business rules; every query scoped by ctx.ownerId
             ├── src/lib/db                 Prisma 7 client (pg driver adapter)
             └── src/lib/storage            private filesystem storage (0700 dirs, 0600 files)
PostgreSQL ◄─┘                Data dir: documents/, backups/, logs/
```

## Layering rules

- Components never import Prisma, `@/lib/db`, or services (enforced by ESLint `no-restricted-imports`).
- Pages may call services, never Prisma directly.
- Services take `(db, ctx: AuthContext, input)`. `ctx.ownerId` comes only from the validated session; client-supplied
  owner IDs do not exist in any input schema.
- Records belonging to another owner are reported as `404 NOT_FOUND`, never `403`, so existence is not disclosed.
- Every mutation writes an `audit_logs` row in the same transaction.

## Data model

| Table                   | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `users`                 | Single owner; scrypt password hash; lockout counters                             |
| `sessions`              | SHA-256 of session tokens, expiry, revocation                                    |
| `career_profiles`       | One per owner (unique `owner_id`), optimistic `revision`                         |
| `documents`             | Uploaded originals: server-generated storage key, SHA-256, size, MIME            |
| `fact_sources`          | Evidence: document, URL, reference or owner attestation                          |
| `career_facts`          | Typed facts (`content_json` validated per type), verification status, `revision` |
| `career_fact_revisions` | Immutable snapshot per change (append-only by trigger)                           |
| `audit_logs`            | Actor, action, entity, request ID; never secrets or document contents            |
| `idempotency_keys`      | Stored responses for retried create requests                                     |

Database-level guarantees (migration `integrity_constraints`): verified facts must have a source; rejected facts must
have a reason; document sources must reference a document; revisions are append-only; audit rows cannot be deleted.

## Fact verification

```
unverified ──verify (needs source)──► verified ──reopen──► unverified
     │                                   │
     └──reject (needs reason)──► rejected ──reopen──► unverified
verified ──(replacement fact verified)──► superseded   (terminal, read-only)
```

Editing the content or source of a verified fact returns it to `unverified`. Only `listVerifiedFacts()` should feed
future generation features.

## Security controls in place

- Session cookie: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` over HTTPS (see ADR 0002).
- Same-origin check (`Origin` / `Sec-Fetch-Site`) on every mutating API request.
- Login lockout: 5 failures → 15 minutes; identical error for unknown email and wrong password.
- Password reset revokes all sessions.
- Upload allowlist with magic-byte checks, size limit, sanitised display names, files served only as attachments.
- Stored file checksums verified on every download.
- Security headers: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, COOP.
- Logger redacts keys matching password/secret/token/cookie/authorization/api key/hash.

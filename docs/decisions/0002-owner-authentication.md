# ADR 0002: Single-owner authentication with database sessions

Status: accepted (Milestone 1)

## Decision

- No registration endpoint. The owner is created by `pnpm owner:create`, which refuses if any user exists.
- Passwords: scrypt (N=2^15, r=8, p=1) from Node's standard library; minimum 12 characters. No extra dependency.
- Sessions: 256-bit random token in a cookie; only its SHA-256 is stored. Default lifetime 12 hours
  (`SESSION_TTL_HOURS`). Logout and password reset revoke sessions server-side.
- Lockout: 5 consecutive failures lock login for 15 minutes; stored in the database so it survives restarts.
- Cookie: `HttpOnly`, `SameSite=Strict`, `Path=/`. `Secure` is set when the request arrived over HTTPS
  (or `SESSION_COOKIE_SECURE=true`).

## Why not always `Secure`

CareerOS binds to `127.0.0.1` and is reached over plain HTTP. Chromium and Firefox accept `Secure` cookies on
`http://localhost`, but Safari's handling of `Secure` cookies on loopback HTTP has varied between versions, which would
make login silently fail. Traffic never leaves the machine, so the cookie is not exposed on a network. If CareerOS is
ever placed behind HTTPS (e.g. a reverse proxy for iPad access), `Secure` is applied automatically via
`x-forwarded-proto`, and `SESSION_COOKIE_SECURE=true` can force it.

## Rejected alternatives

- Auth.js / NextAuth: designed for multi-user OAuth flows; more surface than a single local owner needs.
- JWT sessions: cannot be revoked server-side without a denylist, which is a session table anyway.

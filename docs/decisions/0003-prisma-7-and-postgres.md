# ADR 0003: Prisma 7 with the pg driver adapter

Status: accepted (Milestone 1)

## Decision

Prisma 7.10 (latest stable at implementation time; 8.x was release-candidate only), using the `prisma-client`
generator (output `src/generated/prisma`, not committed) and `@prisma/adapter-pg`. Connection settings live in
`prisma.config.ts`. Schema changes go through `prisma migrate dev` locally and `prisma migrate deploy` everywhere else;
`db push` and resets are not used.

Constraints Prisma cannot express (CHECKs, append-only triggers) are in a hand-written migration,
`*_integrity_constraints`.

## Known issue

Prisma's query interpreter issues overlapping queries on one transaction connection, which makes `pg@8` print a
deprecation warning ("Calling client.query() when the client is already executing a query"). `pg` still queues them
correctly; behaviour is covered by the integration tests. Revisit when upgrading to `pg@9` or Prisma 8.

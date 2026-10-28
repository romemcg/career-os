# ADR 0001: CareerOS has its own repository

Status: accepted (28 October 2026)

## Context

The specification calls for a new standalone codebase. Milestone 1 was first developed inside an unrelated template
repository (`romemcg23/nextjs-ai-chatbot`) and then moved to a dedicated repository.

## Decision

CareerOS lives in `romemcg/career-os` with no code or history from the template. It has its own database, data
directory and configuration, and shares nothing with Life OS or any other application. Next.js is pinned to the
repository directory as its root so it never infers a parent directory as the project.

## Consequences

- Integrations with Life OS or the speaking coach must go through versioned APIs, never shared code or a shared
  database.

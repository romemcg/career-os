# Environment assessment

## Where Milestone 1 was built

Milestone 1 was implemented and tested in an ephemeral Linux cloud container, **not on the owner's Mac**. Findings
from that environment (28 October 2026):

| Item          | Finding                                                         |
| ------------- | --------------------------------------------------------------- |
| OS            | Linux (x86_64)                                                  |
| Memory / disk | 15 GiB RAM, ~30 GiB free                                        |
| Node.js       | 22.22.0                                                         |
| pnpm          | 10.28.0                                                         |
| PostgreSQL    | 16.15, installed but stopped; started for development and tests |
| Chromium      | Pre-installed for Playwright 1.63                               |
| Repository    | `romemcg/career-os`, dedicated to CareerOS                      |

## What still needs checking on the Mac

These could not be inspected from the build environment. Run before setup:

```bash
sw_vers; sysctl -n hw.memsize | awk '{print $1/1073741824 " GB"}'; df -h ~
node -v; pnpm -v; psql --version; brew services list | grep -i postgres
lsof -nP -iTCP:3000 -sTCP:LISTEN   # Life OS (leave untouched)
lsof -nP -iTCP:3001 -sTCP:LISTEN   # must be free for CareerOS
lsof -nP -iTCP:5432 -sTCP:LISTEN   # existing PostgreSQL may be shared; CareerOS uses its own role and databases
```

Risks to confirm:

- **Existing PostgreSQL used by Life OS.** Sharing the server is fine, but CareerOS must have its own role and database.
  Never run `pg_restore` from CareerOS backups against another application's database.
- **Ollama / local AI** is not needed for Milestone 1. Hardware suitability (RAM, Apple Silicon generation) should be
  assessed before Milestone 2's AI adapter (CAR-011).
- **Safari and `Secure` cookies on plain HTTP.** See ADR 0002.

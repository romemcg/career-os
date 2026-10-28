# CareerOS

Private, local-first career management application for a single owner.

**Status: Milestone 1 (Working Foundation), tickets CAR-001 to CAR-008.** Implemented: owner authentication, a career
knowledge base with source-backed facts and a verification workflow, private document storage, audit logging,
backup/restore. Job intelligence, CV generation, applications, CRM and AI features are later milestones and are not
present in the UI.

## Prerequisites (macOS)

| Tool       | Version | Install                             |
| ---------- | ------- | ----------------------------------- |
| Node.js    | 22 LTS  | `brew install node@22`              |
| pnpm       | 10      | `corepack enable` (ships with Node) |
| PostgreSQL | 16      | `brew install postgresql@16`        |

Check what is already present before installing anything:

```bash
node -v; pnpm -v; psql --version; pg_dump --version
lsof -nP -iTCP:3001 -sTCP:LISTEN   # must be empty (Life OS uses 3000)
lsof -nP -iTCP:5432 -sTCP:LISTEN   # an existing PostgreSQL is fine; CareerOS uses its own database
```

## First-time setup

```bash
git clone https://github.com/romemcg/career-os.git
cd career-os

# 1. Database (own role and databases; does not touch other applications' databases)
brew services start postgresql@16     # skip if PostgreSQL is already running
createuser --pwprompt careeros        # choose a password
createdb --owner careeros careeros
createdb --owner careeros careeros_test   # used only by tests

# 2. Configuration
cp .env.example .env
chmod 600 .env
# edit DATABASE_URL / TEST_DATABASE_URL with the password chosen above

# 3. Install, migrate, create the owner account
pnpm install
pnpm db:migrate
pnpm owner:create                     # prompts for email and password (min 12 chars)

# 4. Build and start (binds to 127.0.0.1:3001 only)
pnpm build
pnpm start
```

Open http://127.0.0.1:3001 and sign in. Data lives in `~/Library/Application Support/CareerOS` unless
`CAREEROS_DATA_DIR` is set.

## Everyday commands

| Task                            | Command                                           |
| ------------------------------- | ------------------------------------------------- |
| Start (production build)        | `pnpm start`                                      |
| Start (development, hot reload) | `pnpm dev`                                        |
| Stop                            | `Ctrl+C`, or `launchctl bootout` if using launchd |
| Health check                    | `pnpm healthcheck`                                |
| Back up                         | `pnpm backup`                                     |
| Restore                         | `pnpm restore -- <backup-dir>`                    |
| Reset password                  | `pnpm owner:reset-password`                       |
| Migration status                | `pnpm db:status`                                  |

Running automatically at login: see [docs/runbooks/operations.md](docs/runbooks/operations.md).

## Tests

```bash
pnpm test        # unit, component and integration tests (integration uses TEST_DATABASE_URL)
pnpm test:e2e    # builds, then runs Playwright against a server on port 3101 using TEST_DATABASE_URL
pnpm lint && pnpm typecheck && pnpm format:check
```

Integration and end-to-end tests **delete all data in `TEST_DATABASE_URL`**; they refuse to run if it equals
`DATABASE_URL`.

## Documentation

- [Architecture overview](docs/architecture/overview.md)
- [Environment assessment](docs/architecture/environment-assessment.md)
- [API v1](docs/api/v1.md)
- [Decision records](docs/decisions/)
- [Operations: startup, shutdown, launchd, troubleshooting](docs/runbooks/operations.md)
- [Backup and restore](docs/runbooks/backup-and-restore.md)
- [Milestone 1 report](docs/milestone-1-report.md)

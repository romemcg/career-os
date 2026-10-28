# Operations runbook

## Start and stop manually

```bash
cd career-os
pnpm build          # after pulling changes
pnpm db:migrate     # after pulling changes that include migrations
pnpm start          # 127.0.0.1:3001; Ctrl+C to stop (graceful)
pnpm healthcheck    # {"status":"ok","checks":{"config":"ok","database":"ok","storage":"ok"}}
```

## Run at login with launchd (optional, per-user)

Nothing is installed automatically. To opt in:

```bash
DATA_DIR="$HOME/Library/Application Support/CareerOS"
mkdir -p "$DATA_DIR/logs"
sed -e "s#__CAREEROS_DIR__#$PWD#g" -e "s#__DATA_DIR__#$DATA_DIR#g" \
  scripts/launchd/com.careeros.app.plist.template > ~/Library/LaunchAgents/com.careeros.app.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.careeros.app.plist
```

Stop / start / remove:

```bash
launchctl bootout gui/$(id -u)/com.careeros.app                          # stop and unload
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.careeros.app.plist   # start again
launchctl kickstart -k gui/$(id -u)/com.careeros.app                     # restart (e.g. after pnpm build)
rm ~/Library/LaunchAgents/com.careeros.app.plist                         # after bootout, to uninstall
```

Logs: `~/Library/Application Support/CareerOS/logs/`. Life OS on port 3000 is unaffected.

## Updating

1. `pnpm backup`
2. `git pull`, `pnpm install`, `pnpm db:migrate`, `pnpm build`
3. Restart (`launchctl kickstart -k ...` or `pnpm start`)

Rollback: restore the backup taken in step 1 with the previous code checked out (migrations are forward-only).

## Troubleshooting

| Symptom                                          | Check                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `Invalid configuration: DATABASE_URL`            | `.env` exists in the repository root and contains `DATABASE_URL`                                         |
| Health reports `database: error`                 | `brew services list`; `psql "$DATABASE_URL" -c 'select 1'`                                               |
| Health reports `storage: error`                  | Data directory exists and is writable by your user                                                       |
| `EADDRINUSE :3001`                               | `lsof -nP -iTCP:3001 -sTCP:LISTEN`; set `PORT` in `.env` if needed                                       |
| Login says "Too many failed attempts"            | Wait 15 minutes, or `pnpm owner:reset-password`                                                          |
| Login succeeds but you are sent back to `/login` | Browser blocked the cookie; ensure you use `http://127.0.0.1:3001` consistently (not mixing `localhost`) |
| `Cross-origin request rejected` from a script    | Send `Origin: http://127.0.0.1:3001` on POST/PATCH/DELETE                                                |
| Download fails with "integrity check"            | The stored file was altered; restore from backup                                                         |
| Migration drift                                  | `pnpm db:status`; never edit applied migrations                                                          |

# Backup and restore

## Backup

```bash
pnpm backup
```

Creates `<data-dir>/backups/<UTC timestamp>/` with:

- `database.dump` (pg_dump custom format, no owner)
- `documents.tar.gz` (the private documents directory)
- `manifest.json` (SHA-256 and size of each file, latest migration name)

Each archive is read back (`pg_restore --list`, `tar -t`) before the backup is marked complete. Incomplete backups are
left as `*.partial` and removed on error. The newest `CAREEROS_BACKUP_RETENTION` (default 14) backups are kept.

Schedule daily (optional): add `pnpm backup` to a second LaunchAgent with `StartCalendarInterval`, or run it manually
before updates. Copy backups off the Mac (e.g. an encrypted external drive) for disaster recovery; the backup directory
is on the same disk as the data.

## Restore

1. Stop CareerOS (the script refuses while port 3001 is in use).
2. `pnpm restore -- "<data-dir>/backups/<timestamp>"`
3. Type `RESTORE` to confirm.

The script verifies the manifest checksums first and aborts on mismatch. It moves the current documents directory to
`documents.pre-restore-<timestamp>` (nothing is deleted), restores the database in a single transaction, extracts the
documents, then runs `pnpm restore:verify`, which checks every document file against its stored SHA-256 and that every
fact has revision history.

## Restore drill (performed during Milestone 1)

Created a fact, restarted the server and confirmed it persisted; backed up; truncated `career_facts`, `fact_sources`,
`documents` and deleted the documents directory; restored; verification reported
`{"users":1,"facts":1,"revisions":1,"sources":0,"documents":1,"problems":0}`. A backup with a modified archive was
refused with "Checksum mismatch".

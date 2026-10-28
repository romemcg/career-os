#!/usr/bin/env bash
# Create a verified backup of the CareerOS database and documents.
# Usage: pnpm backup            (retention: CAREEROS_BACKUP_RETENTION, default 14)
set -euo pipefail
. "$(dirname "$0")/../lib.sh"
load_env
require pg_dump pg_restore tar

RETENTION="${CAREEROS_BACKUP_RETENTION:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$BACKUP_DIR/$STAMP"
umask 077
mkdir -p "$TARGET.partial"
WORK="$TARGET.partial"
trap 'rm -rf "$WORK"' ERR

echo "Backing up database..."
pg_dump --format=custom --no-owner --file="$WORK/database.dump" "$(pg_url)"

echo "Backing up documents..."
mkdir -p "$DOCUMENTS_DIR"
tar -C "$CAREEROS_DATA_DIR" -czf "$WORK/documents.tar.gz" documents

echo "Verifying archive readability..."
pg_restore --list "$WORK/database.dump" >/dev/null
tar -tzf "$WORK/documents.tar.gz" >/dev/null

MIGRATION="$(ls "$SCRIPT_ROOT/prisma/migrations" | grep -E '^[0-9]{14}_' | sort | tail -1)"
cat > "$WORK/manifest.json" <<JSON
{
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "app": "careeros",
  "latestMigration": "$MIGRATION",
  "files": {
    "database.dump": { "sha256": "$(sha256_of "$WORK/database.dump")", "bytes": $(wc -c < "$WORK/database.dump" | tr -d ' ') },
    "documents.tar.gz": { "sha256": "$(sha256_of "$WORK/documents.tar.gz")", "bytes": $(wc -c < "$WORK/documents.tar.gz" | tr -d ' ') }
  }
}
JSON

mv "$WORK" "$TARGET"
trap - ERR
echo "Backup complete: $TARGET"

# Retention: keep the newest $RETENTION completed backups (portable to macOS bash 3.2).
ls -1d "$BACKUP_DIR"/*Z 2>/dev/null | sort -r | tail -n +"$((RETENTION + 1))" | while IFS= read -r dir; do
  rm -rf "$dir"
  echo "Removed old backup: $(basename "$dir")"
done
exit 0

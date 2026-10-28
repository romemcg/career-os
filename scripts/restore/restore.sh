#!/usr/bin/env bash
# Restore CareerOS from a backup directory, then verify record and file integrity.
# Usage: pnpm restore -- <backup-dir>   (stop CareerOS first)
set -euo pipefail
. "$(dirname "$0")/../lib.sh"
load_env
require pg_restore tar node

SOURCE="${1:-}"
if [[ -z "$SOURCE" || ! -f "$SOURCE/manifest.json" ]]; then
  echo "Usage: pnpm restore -- <backup-dir>" >&2
  echo "Available backups:" >&2
  ls -1d "$BACKUP_DIR"/*Z 2>/dev/null >&2 || echo "  (none in $BACKUP_DIR)" >&2
  exit 1
fi

PORT="${PORT:-3001}"
if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
  echo "CareerOS appears to be running on port $PORT. Stop it before restoring." >&2
  exit 1
fi

echo "Checking backup checksums..."
for file in database.dump documents.tar.gz; do
  expected="$(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(m.files[process.argv[2]]?.sha256??"")' "$SOURCE/manifest.json" "$file")"
  actual="$(sha256_of "$SOURCE/$file")"
  [[ "$expected" == "$actual" ]] || { echo "Checksum mismatch for $file; backup is corrupt." >&2; exit 1; }
done

echo "This will REPLACE the current CareerOS database and documents with the backup from:"
echo "  $SOURCE"
if [[ "${CAREEROS_RESTORE_CONFIRM:-}" != "RESTORE" ]]; then
  read -r -p "Type RESTORE to continue: " answer
  [[ "$answer" == "RESTORE" ]] || { echo "Cancelled."; exit 1; }
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
if [[ -d "$DOCUMENTS_DIR" ]]; then
  mv "$DOCUMENTS_DIR" "$CAREEROS_DATA_DIR/documents.pre-restore-$STAMP"
  echo "Current documents kept at: $CAREEROS_DATA_DIR/documents.pre-restore-$STAMP"
fi

echo "Restoring database..."
pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$(pg_url)" "$SOURCE/database.dump"

echo "Restoring documents..."
umask 077
tar -C "$CAREEROS_DATA_DIR" -xzf "$SOURCE/documents.tar.gz"

echo "Verifying restored data..."
cd "$SCRIPT_ROOT"
npx tsx scripts/restore/verify.ts

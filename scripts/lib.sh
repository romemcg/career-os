#!/usr/bin/env bash
# Shared helpers for CareerOS operational scripts. Never prints secrets.
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

load_env() {
  if [[ -f "$SCRIPT_ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    . "$SCRIPT_ROOT/.env"
    set +a
  fi
  : "${DATABASE_URL:?DATABASE_URL is not set (see .env.example)}"
  if [[ -z "${CAREEROS_DATA_DIR:-}" ]]; then
    if [[ "$(uname)" == "Darwin" ]]; then
      CAREEROS_DATA_DIR="$HOME/Library/Application Support/CareerOS"
    else
      CAREEROS_DATA_DIR="$HOME/.local/share/careeros"
    fi
  fi
  export CAREEROS_DATA_DIR
  BACKUP_DIR="${CAREEROS_BACKUP_DIR:-$CAREEROS_DATA_DIR/backups}"
  DOCUMENTS_DIR="$CAREEROS_DATA_DIR/documents"
}

# pg tools reject Prisma-only query parameters such as ?schema=public.
pg_url() {
  printf '%s' "${DATABASE_URL%%\?*}"
}

sha256_of() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

require() {
  for tool in "$@"; do
    command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
  done
}

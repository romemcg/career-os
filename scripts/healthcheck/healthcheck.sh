#!/usr/bin/env bash
# Exit 0 when CareerOS reports healthy. Usage: pnpm healthcheck
set -euo pipefail
PORT="${PORT:-3001}"
body="$(curl -fsS --max-time 5 "http://127.0.0.1:$PORT/api/health")" || { echo "CareerOS is not responding on 127.0.0.1:$PORT" >&2; exit 1; }
echo "$body"

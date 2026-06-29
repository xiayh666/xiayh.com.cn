#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/cm311-knowledge"
REPO="$ROOT/data/notes"

if [[ ! -d "$REPO/.git" ]]; then
  echo "notes repository is not initialized: $REPO" >&2
  exit 1
fi

git -C "$REPO" pull --ff-only

curl -fsS -X POST http://127.0.0.1:8080/api/admin/sync \
  -H "x-sync-token: $SYNC_TOKEN" \
  -H 'content-type: application/json' \
  --data '{}'

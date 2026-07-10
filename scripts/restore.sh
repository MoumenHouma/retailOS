#!/usr/bin/env bash
# Phase 6 Chunk D: reverse of backup.sh. Usage: ./scripts/restore.sh <path-to-db-backup.sql.gz>
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-db-backup.sql.gz>" >&2
  exit 1
fi

DUMP_FILE="$1"
if [ ! -f "$DUMP_FILE" ]; then
  echo "File not found: $DUMP_FILE" >&2
  exit 1
fi

echo "!! This will overwrite the current database. Ctrl-C to abort."
read -r -p "Type 'restore' to confirm: " CONFIRM
if [ "$CONFIRM" != "restore" ]; then
  echo "Aborted."
  exit 1
fi

echo "==> Restoring Postgres from $DUMP_FILE"
gunzip -c "$DUMP_FILE" | $COMPOSE exec -T postgres psql -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-retailos}"

echo "==> Restore complete. Run 'docker compose -f docker-compose.prod.yml restart app worker realtime' to pick up any schema changes."

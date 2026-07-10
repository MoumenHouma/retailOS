#!/usr/bin/env bash
# Phase 6 Chunk D: plain backup script + a documented host crontab line —
# not a new BullMQ job. Backups are infra-ops, not app-domain work; keeps
# worker.ts scoped to application jobs (forecast/mcda/simulation/report),
# matching its existing scope. Suggested crontab (daily at 03:00):
#   0 3 * * * cd /path/to/retailos && ./scripts/backup.sh >> /var/log/retailos-backup.log 2>&1
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "==> Dumping Postgres"
$COMPOSE exec -T postgres pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-retailos}" \
  | gzip > "$BACKUP_DIR/db-$TIMESTAMP.sql.gz"

echo "==> Mirroring MinIO bucket"
$COMPOSE exec -T minio mc mirror --overwrite "local/${S3_BUCKET:-retailos}" "/data-backup/$TIMESTAMP" 2>/dev/null \
  || echo "  (mc mirror inside the minio container needs an alias set — see docs/admin-guide.md)"

echo "==> Pruning backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

echo "==> Backup complete: $BACKUP_DIR/db-$TIMESTAMP.sql.gz"

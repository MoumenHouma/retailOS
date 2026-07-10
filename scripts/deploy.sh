#!/usr/bin/env bash
# Phase 6 Chunk D: production deploy script for the single-VM docker-compose
# target (ARCHITECTURE.md's own "low-devops" framing — no Kubernetes/
# Terraform/CI-deploy pipeline). Run from the repo root on the target VM.
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building images"
$COMPOSE build

echo "==> Running database migrations (migrate deploy, not migrate dev)"
$COMPOSE run --rm app npx prisma migrate deploy

echo "==> Starting services"
$COMPOSE up -d

echo "==> Waiting for app readiness"
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/api/health/ready > /dev/null 2>&1; then
    echo "==> App is ready"
    exit 0
  fi
  sleep 2
done

echo "==> App did not become ready in time" >&2
$COMPOSE logs --tail=100 app >&2
exit 1

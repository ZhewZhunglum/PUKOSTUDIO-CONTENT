#!/bin/bash
# Fix Docker network isolation after container restarts.
# Run this whenever containers are recreated with docker compose up.
set -e

INTERNAL=contentforge_internal

echo "=== ContentForge network reconnect ==="

connect() {
  local container=$1
  local alias=$2
  if docker network connect --alias "$alias" "$INTERNAL" "$container" 2>/dev/null; then
    echo "  ✓ $container → $INTERNAL (alias: $alias)"
  else
    echo "  - $container already connected"
  fi
}

connect contentforge-frontend-1  frontend
connect contentforge-backend-1   backend
connect contentforge-worker-1    worker
connect contentforge-worker-2    worker
connect contentforge-minio-1     minio
connect contentforge-postgres-1  postgres
connect contentforge-redis-1     redis

echo "=== Reloading nginx ==="
docker exec contentforge-nginx-1 nginx -s reload 2>/dev/null && echo "  ✓ nginx reloaded" || echo "  - nginx reload skipped"

echo "=== Done ==="

#!/usr/bin/env bash
# =============================================================================
# ContentForge — deploy / update script
# Run from the project root on the Hetzner server
# Usage: bash deploy/deploy.sh [--no-pull]
# =============================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$APP_DIR/.env.prod"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml --env-file $ENV_FILE"

cd "$APP_DIR"

# ── Sanity checks ─────────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌  Missing $ENV_FILE"
  echo "    cp .env.prod.example .env.prod  then fill in values"
  exit 1
fi

# Source env to validate critical vars
set -a; source "$ENV_FILE"; set +a

required=(DATABASE_URL S3_ENDPOINT S3_ACCESS_KEY S3_SECRET_KEY \
          S3_BUCKET S3_PUBLIC_DOMAIN S3_PRESIGNED_ENDPOINT \
          NEXT_PUBLIC_API_URL SECRET_KEY SERVER_IP \
          MINIO_ROOT_USER MINIO_ROOT_PASSWORD)
for var in "${required[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "❌  $var is not set in $ENV_FILE"
    exit 1
  fi
done

# ── Pull latest code ──────────────────────────────────────────────────────────
if [[ "${1:-}" != "--no-pull" ]]; then
  echo "==> [1] git pull"
  git pull --ff-only
else
  echo "==> [1] Skipping git pull (--no-pull)"
fi

# ── Build images ──────────────────────────────────────────────────────────────
echo "==> [2] Build Docker images"
$COMPOSE build --pull

# ── Run database migrations ───────────────────────────────────────────────────
echo "==> [3] Run Alembic migrations"
$COMPOSE run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  backend \
  alembic upgrade head

# ── Start / restart services ──────────────────────────────────────────────────
echo "==> [4] Start services"
$COMPOSE up -d --remove-orphans
$COMPOSE restart nginx

# ── Health check ──────────────────────────────────────────────────────────────
echo "==> [5] Health check (waiting up to 60s)..."
for i in $(seq 1 12); do
  sleep 5
  STATUS=$(curl -sf http://localhost/healthz 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "unreachable")
  echo "    attempt $i/12 → $STATUS"
  if [[ "$STATUS" == "ok" ]]; then
    echo ""
    echo "✅  Deploy complete. ContentForge is running at $NEXT_PUBLIC_API_URL"
    $COMPOSE ps
    exit 0
  fi
done

echo ""
echo "⚠️   Health check did not return 'ok' within 60s. Check logs:"
echo "    docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=50"
exit 1

#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-surveyapp}"
DB_NAME="${DB_NAME:-survey_db}"
DB_PASSWORD="${DB_PASSWORD:-surveysecret}"
CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-survey-postgres}"

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/${DB_NAME}-${TIMESTAMP}.dump"
LATEST_FILE="$BACKUP_DIR/${DB_NAME}-latest.dump"

echo "Creating PostgreSQL backup for $DB_NAME..."

resolve_container_name() {
  if command -v docker-compose >/dev/null 2>&1; then
    local compose_id
    compose_id="$(cd "$ROOT_DIR" && docker-compose ps -q postgres 2>/dev/null || true)"
    if [ -n "$compose_id" ]; then
      docker ps --filter "id=$compose_id" --format '{{.Names}}' | head -n 1
      return
    fi
  fi

  docker ps --format '{{.Names}}' | grep 'survey-postgres' | head -n 1 || true
}

DETECTED_CONTAINER_NAME="$(resolve_container_name)"

if command -v pg_dump >/dev/null 2>&1 && pg_dump --version >/dev/null 2>&1; then
  PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -F c \
    -f "$BACKUP_FILE"
elif command -v docker >/dev/null 2>&1 && [ -n "${DETECTED_CONTAINER_NAME:-}" ]; then
  docker exec \
    -e PGPASSWORD="$DB_PASSWORD" \
    "$DETECTED_CONTAINER_NAME" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" -F c > "$BACKUP_FILE"
else
  echo "Error: neither local pg_dump nor a running Postgres container is available."
  exit 1
fi

cp "$BACKUP_FILE" "$LATEST_FILE"
echo "Backup saved to $BACKUP_FILE"
echo "Latest backup copied to $LATEST_FILE"

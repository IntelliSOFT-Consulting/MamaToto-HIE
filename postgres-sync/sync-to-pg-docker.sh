#!/bin/bash

set -e  # Exit on error

# Timestamped logging function
log() {
  echo "[$(date)] $1" | tee -a /var/log/cron.log
}

log "Starting sync..."

# Load .env file (default to .env in current dir if not passed)
ENV_FILE="${1:-.env}"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
  log "Loaded environment variables from $ENV_FILE"
else
  log "Environment file '$ENV_FILE' not found. Exiting."
  exit 1
fi

# Ensure required env vars are present
: "${DB_NAME:?Missing DB_NAME}"
: "${DB_USER:?Missing DB_USER}"
: "${DB_PASSWORD:?Missing DB_PASSWORD}"
: "${DB_HOST:?Missing DB_HOST}"
: "${CLOUDSQL_DB_NAME:?Missing CLOUDSQL_DB_NAME}"
: "${CLOUDSQL_USER:?Missing CLOUDSQL_USER}"
: "${CLOUDSQL_PASSWORD:?Missing CLOUDSQL_PASSWORD}"
: "${CLOUDSQL_HOST:?Missing CLOUDSQL_HOST}"

# Optional port vars, default to 5432
DB_PORT=${DB_PORT:-5432}
CLOUDSQL_PORT=${CLOUDSQL_PORT:-5432}

# Create a temp volume to store the SQL dump
DUMP_PATH="/tmp/pgsync-dump.sql"

# Dump from local PostgreSQL using Docker
log "Dumping $DB_NAME from $DB_HOST via Docker..."
docker run --rm \
  -v "$(dirname "$DUMP_PATH"):/backup" \
  postgres:latest \
  bash -c "PGPASSWORD='$DB_PASSWORD' pg_dump -h '$DB_HOST' -p $DB_PORT -U '$DB_USER' -d '$DB_NAME' > /backup/$(basename "$DUMP_PATH")"

# Restore into Cloud SQL using Docker
log "Restoring to $CLOUDSQL_DB_NAME on $CLOUDSQL_HOST via Docker..."
docker run --rm \
  -v "$(dirname "$DUMP_PATH"):/backup" \
  postgres:latest \
  bash -c "PGPASSWORD='$CLOUDSQL_PASSWORD' psql -h '$CLOUDSQL_HOST' -p $CLOUDSQL_PORT -U '$CLOUDSQL_USER' -d '$CLOUDSQL_DB_NAME' -f /backup/$(basename "$DUMP_PATH")"

log "CloudSQL Sync completed successfully."

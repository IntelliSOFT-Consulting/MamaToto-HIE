#!/bin/bash

# Timestamp for logs
echo "[$(date)] Starting sync..."
echo "[$(date)] Starting sync..." >> /var/log/cron.log

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

# Dump from local Docker PostgreSQL
PGPASSWORD=$DB_PASSWORD pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /tmp/dump.sql

# Import into Cloud SQL
PGPASSWORD=$CLOUDSQL_PASSWORD psql -h "$CLOUDSQL_HOST" -p "$CLOUDSQL_PORT" -U "$CLOUDSQL_USER" -d "$CLOUDSQL_DB_NAME" -f /tmp/dump.sql

echo "[$(date)] CloudSQL Sync completed." >> /var/log/cron.log
echo "[$(date)] CloudSQL Sync completed."

#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${POSTGRES_USER:-disciple}"; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is ready - running migrations..."

# Run all SQL migration files in order
for migration in /app/migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "Running migration: $(basename "$migration")"
    PGPASSWORD="${POSTGRES_PASSWORD:-changeme}" psql \
      -h "${DB_HOST:-postgres}" \
      -p "${DB_PORT:-5432}" \
      -U "${POSTGRES_USER:-disciple}" \
      -d "${POSTGRES_DB:-disciple_db}" \
      -f "$migration"
  fi
done

echo "Migrations completed successfully!"

# Start the application
exec "$@"
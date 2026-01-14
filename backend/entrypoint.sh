#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Wait for the database service to be ready
echo "Waiting for PostgreSQL..."
# Use environment variables passed from docker-compose
# Loop until pg_isready returns success (0)
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q -U "$POSTGRES_USER"; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done
>&2 echo "PostgreSQL started"

# Run database migrations (using alembic)
echo "Running DB migrations..."
alembic upgrade head

# Execute the main command (passed from CMD in Dockerfile or docker-compose command)
echo "Starting application..."
exec "$@"
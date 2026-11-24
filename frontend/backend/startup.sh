#!/usr/bin/env sh
# Start the API: wait for the database, migrate, seed the fictional demo shop, then serve.
# Migrations and seeding are idempotent, so this is safe on every start (including Render free-tier wake-ups).
set -eu

echo "[startup] waiting for database"
python -m app.scripts.wait_for_db

echo "[startup] running migrations"
alembic upgrade head

echo "[startup] seeding demo data (only fills in what is missing)"
python -m app.seed.run

echo "[startup] starting api on port ${PORT:-8000}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'

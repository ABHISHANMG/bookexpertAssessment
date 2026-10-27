#!/usr/bin/env bash
set -e

echo "Waiting for the database to accept connections..."
python - <<'PY'
import os, time, sys
from sqlalchemy import create_engine, text

url = os.environ.get("DATABASE_URL", "mysql+pymysql://sims:sims@db:3306/sims")
for attempt in range(60):
    try:
        create_engine(url, pool_pre_ping=True).connect().execute(text("SELECT 1"))
        print("Database is ready.")
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001
        print(f"  ...not ready yet ({attempt+1}/60): {exc.__class__.__name__}")
        time.sleep(2)
print("Database never became ready; exiting.")
sys.exit(1)
PY

echo "Running database migrations..."
alembic upgrade head

echo "Seeding database (idempotent)..."
python -m app.seed || echo "Seed step reported an issue (continuing)."

echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

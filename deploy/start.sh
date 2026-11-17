#!/bin/sh
# Runs on every deploy and restart: bring the database schema up to date, load any new daily
# questions (days that already have plays are left alone), then start the web server.
set -e

cd /app/backend
alembic upgrade head

cd /app
python scripts/load_content.py content/

# Trust the host's HTTPS proxy so requests (and the player cookie) are treated as secure.
export FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-*}"

exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers

# Hummingbird: one container that serves the API and the built website.

# ---- 1. Build the frontend
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. Run the API, which also serves the built site at /
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    RAPIDQ_FRONTEND_DIST=/app/frontend/dist
WORKDIR /app

COPY backend/pyproject.toml backend/pyproject.toml
COPY backend/app backend/app
RUN pip install ./backend

COPY backend/alembic.ini backend/alembic.ini
COPY backend/migrations backend/migrations
COPY content content
COPY scripts scripts
COPY deploy/start.sh start.sh
COPY --from=web /web/dist frontend/dist

RUN useradd --create-home --uid 10001 app && chmod +x start.sh
USER app

EXPOSE 8000
CMD ["/app/start.sh"]

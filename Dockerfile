# ── Stage 1: build the React frontend ──────────────────────────────────────
FROM node:20-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python runtime ────────────────────────────────────────────────
FROM python:3.13-slim

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY --from=frontend /build/dist frontend/dist

EXPOSE 3000

CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:3000", "--chdir", "backend", "wsgi:app"]

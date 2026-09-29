"""Entry point for gunicorn: `gunicorn -b 0.0.0.0:3000 wsgi:app`.

Importing app runs bootstrap() — migrations and the seed admin account —
once per worker process. The migration lock makes exactly one of them do
the work.
"""
from app import app  # noqa: F401

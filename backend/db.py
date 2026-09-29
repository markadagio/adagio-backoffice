"""Database connection and a forward-only migration runner.

Ported from the HR system's backend/db.py — same shape, same idiom, so
"how does this app talk to Postgres" has one answer across the apps this
person maintains. Migrations are numbered .sql files applied in filename
order and recorded in schema_migration, so a rerun is a no-op.
"""
import os
import pathlib
from contextlib import contextmanager

from psycopg_pool import ConnectionPool

MIGRATIONS_DIR = pathlib.Path(__file__).parent / "migrations"

# A gitignored .env beside the repo root, for running the backend directly
# during development. setdefault, not overwrite: a real environment variable
# always wins, so a stale file on a server can never quietly redirect the
# container that compose configured properly.
_ENV_FILE = pathlib.Path(__file__).parent.parent / ".env"
if _ENV_FILE.exists():
    for _line in _ENV_FILE.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://adagio_app@192.168.216.16:5432/adagio"
)

_pool = ConnectionPool(
    DATABASE_URL,
    min_size=int(os.environ.get("DB_POOL_MIN", "2")),
    max_size=int(os.environ.get("DB_POOL_MAX", "8")),
    kwargs={"options": "-c timezone=UTC"},
    max_idle=300,
    open=True,
)


@contextmanager
def connect():
    """A pooled connection in a transaction, pinned to UTC.

    Use for writes: psycopg opens a transaction on the first statement and
    commits on exit, so a multi-statement change is all-or-nothing.
    """
    with _pool.connection() as conn:
        yield conn


@contextmanager
def read():
    """A pooled connection in autocommit, for read-only work."""
    with _pool.connection() as conn:
        conn.autocommit = True
        try:
            yield conn
        finally:
            conn.autocommit = False


def one(conn, sql, params=()):
    """First row as a dict, or None. Saves repeating cursor.description."""
    cur = conn.execute(sql, params)
    row = cur.fetchone()
    if row is None:
        return None
    return dict(zip([c.name for c in cur.description], row))


def all_rows(conn, sql, params=()):
    cur = conn.execute(sql, params)
    cols = [c.name for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def _applied(conn) -> set:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migration (
            version    text PRIMARY KEY,
            applied_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    return {r[0] for r in conn.execute("SELECT version FROM schema_migration")}


# Arbitrary but fixed: every process that migrates this database contends on
# the same advisory lock id.
MIGRATION_LOCK_ID = 0x41444742  # "ADGB"


def migrate(verbose: bool = True) -> list:
    """Apply every migration not yet recorded.

    Gunicorn boots several workers that each import the app and call this at
    once. Checking schema_migration is not enough on its own — an advisory
    lock makes exactly one worker migrate while the rest wait and then find
    the work already done.
    """
    applied_now = []
    done = set()
    with connect() as conn:
        conn.execute("SELECT pg_advisory_lock(%s)", (MIGRATION_LOCK_ID,))
        conn.commit()
        try:
            done = _applied(conn)
            conn.commit()
            for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
                version = path.stem
                if version in done:
                    continue
                if verbose:
                    print(f"  applying {version} …")
                try:
                    conn.execute(path.read_text())
                    conn.execute(
                        "INSERT INTO schema_migration (version) VALUES (%s)", (version,)
                    )
                    conn.commit()
                    applied_now.append(version)
                except Exception:
                    conn.rollback()
                    raise
        finally:
            conn.execute("SELECT pg_advisory_unlock(%s)", (MIGRATION_LOCK_ID,))
            conn.commit()
    if verbose:
        print(f"  {len(applied_now)} applied, {len(done)} already present")
    return applied_now


if __name__ == "__main__":
    print(f"migrating {DATABASE_URL.rsplit('@', 1)[-1]}")
    migrate()

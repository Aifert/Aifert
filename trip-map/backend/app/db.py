"""Postgres pool, schema, and row helpers."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Iterator

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS stops (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    country_code TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    timezone TEXT NOT NULL,
    arrive_at TIMESTAMPTZ NOT NULL,
    depart_at TIMESTAMPTZ NOT NULL,
    lodging_name TEXT,
    lodging_address TEXT,
    confirmation TEXT,
    lodging_notes TEXT,
    lodging_booked BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS legs (
    id SERIAL PRIMARY KEY,
    from_stop_id INTEGER REFERENCES stops(id) ON DELETE SET NULL,
    to_stop_id INTEGER REFERENCES stops(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    booked BOOLEAN NOT NULL DEFAULT FALSE,
    carrier TEXT,
    flight_no TEXT,
    confirmation TEXT,
    depart_at TIMESTAMPTZ,
    arrive_at TIMESTAMPTZ,
    from_label TEXT NOT NULL,
    to_label TEXT NOT NULL,
    from_lat DOUBLE PRECISION NOT NULL,
    from_lng DOUBLE PRECISION NOT NULL,
    to_lat DOUBLE PRECISION NOT NULL,
    to_lng DOUBLE PRECISION NOT NULL,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    day DATE,
    title TEXT NOT NULL,
    notes TEXT,
    booked BOOLEAN NOT NULL DEFAULT TRUE,
    optional BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS photos (
    id SERIAL PRIMARY KEY,
    stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    caption TEXT,
    content_type TEXT NOT NULL DEFAULT 'image/jpeg',
    full_bytes BYTEA NOT NULL,
    thumb_bytes BYTEA NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

_pool: ConnectionPool | None = None


def normalize_db_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://"):]
    return url


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        dsn = os.environ.get("DATABASE_URL")
        if not dsn:
            raise RuntimeError("DATABASE_URL is required")
        _pool = ConnectionPool(
            conninfo=normalize_db_url(dsn),
            min_size=1,
            max_size=5,
            open=True,
            kwargs={"autocommit": True, "row_factory": dict_row},
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def get_conn() -> Iterator[Any]:
    with get_pool().connection() as conn:
        yield conn


def init_schema() -> None:
    with get_conn() as conn:
        conn.execute(SCHEMA_SQL)

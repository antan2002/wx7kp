"""SQLite persistence for the Elexon wind dataset."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

SCHEMA = """
CREATE TABLE IF NOT EXISTS actuals (
    start_time TEXT PRIMARY KEY,
    settlement_date TEXT NOT NULL,
    settlement_period INTEGER,
    generation REAL NOT NULL,
    publish_time TEXT
);

CREATE TABLE IF NOT EXISTS forecasts (
    publish_time TEXT NOT NULL,
    start_time TEXT NOT NULL,
    generation REAL NOT NULL,
    PRIMARY KEY (publish_time, start_time)
);

CREATE INDEX IF NOT EXISTS idx_actuals_date ON actuals(settlement_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_publish ON forecasts(publish_time);
CREATE INDEX IF NOT EXISTS idx_forecasts_start ON forecasts(start_time);

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def connect(db_path: Path | str) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def init_db(db_path: Path | str) -> None:
    with connect(db_path) as conn:
        conn.executescript(SCHEMA)


def replace_actuals(db_path: Path | str, frame: pd.DataFrame) -> None:
    rows = []
    for row in frame[
        [
            "start_time",
            "settlement_date",
            "settlement_period",
            "generation",
            "publish_time",
        ]
    ].itertuples(index=False, name=None):
        start_time, settlement_date, settlement_period, generation, publish_time = row
        rows.append(
            (
                str(start_time),
                str(settlement_date),
                int(settlement_period) if pd.notna(settlement_period) else None,
                float(generation),
                str(publish_time),
            )
        )
    with connect(db_path) as conn:
        conn.execute("DELETE FROM actuals")
        conn.executemany(
            """
            INSERT OR REPLACE INTO actuals
                (start_time, settlement_date, settlement_period, generation, publish_time)
            VALUES (?, ?, ?, ?, ?)
            """,
            rows,
        )


def replace_forecasts(db_path: Path | str, frame: pd.DataFrame) -> None:
    rows = [
        (str(publish_time), str(start_time), float(generation))
        for publish_time, start_time, generation in frame[
            ["publish_time", "start_time", "generation"]
        ].itertuples(index=False, name=None)
    ]
    with connect(db_path) as conn:
        conn.execute("DELETE FROM forecasts")
        conn.executemany(
            """
            INSERT OR REPLACE INTO forecasts (publish_time, start_time, generation)
            VALUES (?, ?, ?)
            """,
            rows,
        )


def set_metadata(db_path: Path | str, values: dict[str, str]) -> None:
    with connect(db_path) as conn:
        conn.executemany(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
            list(values.items()),
        )


def get_metadata(db_path: Path | str) -> dict[str, str]:
    with connect(db_path) as conn:
        rows = conn.execute("SELECT key, value FROM metadata").fetchall()
    return {key: value for key, value in rows}


def read_actuals(db_path: Path | str) -> pd.DataFrame:
    with connect(db_path) as conn:
        return pd.read_sql_query(
            """
            SELECT start_time, settlement_date, settlement_period, generation, publish_time
            FROM actuals
            ORDER BY start_time
            """,
            conn,
        )


def read_forecasts(db_path: Path | str) -> pd.DataFrame:
    with connect(db_path) as conn:
        return pd.read_sql_query(
            """
            SELECT publish_time, start_time, generation
            FROM forecasts
            ORDER BY publish_time, start_time
            """,
            conn,
        )


def row_counts(db_path: Path | str) -> dict[str, int]:
    with connect(db_path) as conn:
        actuals = conn.execute("SELECT COUNT(*) FROM actuals").fetchone()[0]
        forecasts = conn.execute("SELECT COUNT(*) FROM forecasts").fetchone()[0]
        vintages = conn.execute(
            "SELECT COUNT(DISTINCT publish_time) FROM forecasts"
        ).fetchone()[0]
    return {
        "actualPeriods": int(actuals),
        "forecastRows": int(forecasts),
        "forecastVintages": int(vintages),
    }

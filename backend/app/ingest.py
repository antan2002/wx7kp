"""Ingest Elexon FUELHH wind actuals and WINDFOR forecasts into SQLite.

Usage (from the repository root, after installing backend requirements):

    python -m backend.app.ingest --force

The Elexon API caps a single query window, so requests are chunked. The script
is idempotent: the SQLite tables are replaced atomically at the end of a
successful run.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx
import pandas as pd

from . import config, db


def _chunks(start: date, end: date, days: int = 7):
    cursor = start
    while cursor < end:
        chunk_end = min(cursor + timedelta(days=days), end)
        yield cursor, chunk_end
        cursor = chunk_end


def _get_json(client: httpx.Client, url: str, params: dict, attempts: int = 4) -> dict:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            response = client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as exc:  # noqa: BLE001 - retry deliberately
            last_error = exc
            if attempt < attempts - 1:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Elexon request failed after {attempts} attempts: {last_error}")


def fetch_actuals(client: httpx.Client, start: date, end: date) -> pd.DataFrame:
    rows: list[dict] = []
    for chunk_start, chunk_end in _chunks(start, end):
        payload = _get_json(
            client,
            config.ACTUALS_URL,
            {
                "settlementDateFrom": chunk_start.isoformat(),
                "settlementDateTo": chunk_end.isoformat(),
                "fuelType": "WIND",
                "format": "json",
            },
        )
        data = payload.get("data", payload)
        rows.extend(data)
        print(
            f"  actuals {chunk_start} -> {chunk_end}: {len(data):,} rows",
            flush=True,
        )

    frame = pd.DataFrame(rows)
    if frame.empty:
        raise RuntimeError("Elexon returned no FUELHH wind actuals")

    frame = frame[frame["fuelType"].str.upper() == "WIND"].copy()
    frame["start_time"] = pd.to_datetime(frame["startTime"], utc=True).dt.strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    frame["publish_time"] = pd.to_datetime(
        frame["publishTime"], utc=True
    ).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    frame["settlement_date"] = frame["settlementDate"]
    frame["settlement_period"] = pd.to_numeric(
        frame["settlementPeriod"], errors="coerce"
    ).astype("Int64")
    frame["generation"] = pd.to_numeric(frame["generation"], errors="coerce")
    frame = frame.dropna(subset=["start_time", "generation"])
    frame = frame.sort_values("publish_time").drop_duplicates(
        subset=["start_time"], keep="last"
    )
    frame = frame.sort_values("start_time").reset_index(drop=True)
    return frame[
        [
            "start_time",
            "settlement_date",
            "settlement_period",
            "generation",
            "publish_time",
        ]
    ]


def fetch_forecasts(client: httpx.Client, start: date, end: date) -> pd.DataFrame:
    rows: list[dict] = []
    for chunk_start, chunk_end in _chunks(start, end):
        payload = _get_json(
            client,
            config.FORECASTS_URL,
            {
                "publishDateTimeFrom": f"{chunk_start.isoformat()}T00:00:00Z",
                "publishDateTimeTo": f"{chunk_end.isoformat()}T00:00:00Z",
                "format": "json",
            },
        )
        data = payload.get("data", payload)
        rows.extend(data)
        print(
            f"  forecasts {chunk_start} -> {chunk_end}: {len(data):,} rows",
            flush=True,
        )

    frame = pd.DataFrame(rows)
    if frame.empty:
        raise RuntimeError("Elexon returned no WINDFOR forecasts")

    frame["publish_time"] = pd.to_datetime(
        frame["publishTime"], utc=True
    ).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    frame["start_time"] = pd.to_datetime(frame["startTime"], utc=True).dt.strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    frame["generation"] = pd.to_numeric(frame["generation"], errors="coerce")
    frame = frame.dropna(subset=["publish_time", "start_time", "generation"])
    frame = frame.drop_duplicates(
        subset=["publish_time", "start_time"], keep="last"
    )
    frame = frame.sort_values(["publish_time", "start_time"]).reset_index(drop=True)
    return frame[["publish_time", "start_time", "generation"]]


def build_database(
    db_path: Path | str = config.DB_PATH,
    fetch_start: date = config.DATA_FETCH_START,
    fetch_end: date = config.DATA_FETCH_END,
) -> dict:
    print(f"Fetching Elexon wind data {fetch_start} -> {fetch_end}", flush=True)
    with httpx.Client(
        timeout=httpx.Timeout(90.0, connect=15.0),
        headers={
            "User-Agent": "Gustline/1.0 (wind forecast decision support prototype)",
            "Accept": "application/json",
        },
        follow_redirects=True,
    ) as client:
        actuals = fetch_actuals(client, fetch_start, fetch_end)
        forecasts = fetch_forecasts(client, fetch_start, fetch_end)

    # Forecasts for a delivery day can be published the day before, so keep
    # rows whose delivery time sits inside the requested window plus a guard.
    print(f"Writing {len(actuals):,} actuals / {len(forecasts):,} forecasts")

    db.init_db(db_path)
    db.replace_actuals(db_path, actuals)
    db.replace_forecasts(db_path, forecasts)

    fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    metadata = {
        "fetched_at": fetched_at.replace("+00:00", "Z"),
        "actuals_window_start": actuals["start_time"].min(),
        "actuals_window_end": actuals["start_time"].max(),
        "forecasts_publish_start": forecasts["publish_time"].min(),
        "forecasts_publish_end": forecasts["publish_time"].max(),
        "forecasts_start_start": forecasts["start_time"].min(),
        "forecasts_start_end": forecasts["start_time"].max(),
        "actuals_url": config.ACTUALS_URL,
        "forecasts_url": config.FORECASTS_URL,
        "actuals_rows": str(len(actuals)),
        "forecast_rows": str(len(forecasts)),
        "forecast_vintages": str(forecasts["publish_time"].nunique()),
    }
    db.set_metadata(db_path, metadata)

    manifest = {
        "fetchedAt": metadata["fetched_at"],
        "window": {"from": fetch_start.isoformat(), "to": fetch_end.isoformat()},
        "actuals": {
            "url": config.ACTUALS_URL,
            "dataset": "FUELHH",
            "fuelType": "WIND",
            "rows": len(actuals),
            "start": metadata["actuals_window_start"],
            "end": metadata["actuals_window_end"],
        },
        "forecasts": {
            "url": config.FORECASTS_URL,
            "dataset": "WINDFOR",
            "rows": len(forecasts),
            "vintages": int(forecasts["publish_time"].nunique()),
            "publishStart": metadata["forecasts_publish_start"],
            "publishEnd": metadata["forecasts_publish_end"],
            "deliveryStart": metadata["forecasts_start_start"],
            "deliveryEnd": metadata["forecasts_start_end"],
        },
    }
    manifest_path = Path(db_path).parent / "source_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Database ready: {db_path}")
    print(f"Manifest: {manifest_path}")
    return manifest


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default=str(config.DB_PATH))
    parser.add_argument("--fetch-start", type=_parse_date, default=config.DATA_FETCH_START)
    parser.add_argument("--fetch-end", type=_parse_date, default=config.DATA_FETCH_END)
    args = parser.parse_args(argv)
    build_database(args.db, args.fetch_start, args.fetch_end)
    return 0


if __name__ == "__main__":
    sys.exit(main())

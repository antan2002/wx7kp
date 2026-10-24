"""Elexon BMRS API fetch logic for FUELHH (actuals) and WINDFOR (forecasts)."""

from __future__ import annotations

import os
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List

import httpx
import pandas as pd

ELEXON_BASE_URL = os.getenv("ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1")
FUELHH_URL = f"{ELEXON_BASE_URL}/datasets/FUELHH"
WINDFOR_URL = f"{ELEXON_BASE_URL}/datasets/WINDFOR"


def _chunks(start: date, end: date, days: int = 7):
    cursor = start
    while cursor < end:
        chunk_end = min(cursor + timedelta(days=days), end)
        yield cursor, chunk_end
        cursor = chunk_end


def _get_json(client: httpx.Client, url: str, params: Dict[str, Any], attempts: int = 4) -> Dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            response = client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt < attempts - 1:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Elexon request failed after {attempts} attempts: {last_error}")


class ElexonService:
    def __init__(self, client: httpx.Client | None = None):
        self.client = client or httpx.Client(
            timeout=httpx.Timeout(90.0, connect=15.0),
            headers={"User-Agent": "WindPowerDashboard/1.0", "Accept": "application/json"},
            follow_redirects=True,
        )

    def fetch_actuals(self, start: date, end: date) -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        for chunk_start, chunk_end in _chunks(start, end):
            payload = _get_json(
                self.client,
                FUELHH_URL,
                {
                    "settlementDateFrom": chunk_start.isoformat(),
                    "settlementDateTo": chunk_end.isoformat(),
                    "fuelType": "WIND",
                    "format": "json",
                },
            )
            data = payload.get("data", payload)
            if isinstance(data, list):
                rows.extend(data)
        frame = pd.DataFrame(rows)
        if frame.empty:
            return []
        frame = frame[frame["fuelType"].astype(str).str.upper() == "WIND"].copy()
        frame["startTime"] = pd.to_datetime(frame["startTime"], utc=True).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        frame["generation"] = pd.to_numeric(frame["generation"], errors="coerce")
        frame = frame.dropna(subset=["startTime", "generation"])
        frame = frame.sort_values("startTime").drop_duplicates(subset=["startTime"], keep="last")
        out = []
        for r in frame[["startTime", "generation"]].itertuples(index=False):
            out.append({"startTime": r.startTime, "generation": float(r.generation)})
        return out

    def fetch_forecasts(self, start: date, end: date) -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        for chunk_start, chunk_end in _chunks(start, end):
            payload = _get_json(
                self.client,
                WINDFOR_URL,
                {
                    "publishDateTimeFrom": f"{chunk_start.isoformat()}T00:00:00Z",
                    "publishDateTimeTo": f"{chunk_end.isoformat()}T00:00:00Z",
                    "format": "json",
                },
            )
            data = payload.get("data", payload)
            if isinstance(data, list):
                rows.extend(data)
        frame = pd.DataFrame(rows)
        if frame.empty:
            return []
        frame["publishTime"] = pd.to_datetime(frame["publishTime"], utc=True).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        frame["startTime"] = pd.to_datetime(frame["startTime"], utc=True).dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        frame["generation"] = pd.to_numeric(frame["generation"], errors="coerce")
        frame = frame.dropna(subset=["startTime", "generation", "publishTime"])
        # Pick latest publishTime per startTime
        frame["publish_dt"] = pd.to_datetime(frame["publishTime"], utc=True)
        idx = frame.groupby("startTime")["publish_dt"].idxmax()
        picked = frame.loc[idx].copy()
        picked = picked.sort_values("startTime")
        out = []
        for r in picked[["startTime", "generation", "publishTime"]].itertuples(index=False):
            out.append({"startTime": r.startTime, "generation": float(r.generation), "publishTime": r.publishTime})
        return out

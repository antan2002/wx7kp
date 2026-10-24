"""Runtime configuration for the Gustline API."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "wind.db"
STATIC_DIR = Path(os.getenv("STATIC_DIR", BACKEND_DIR / "static"))

DB_PATH = Path(os.getenv("WIND_DB_PATH", str(DEFAULT_DB_PATH)))

# Scope agreed with the product manager: purchase decisions made in January 2026.
DELIVERY_START = date(2026, 1, 1)
DELIVERY_END = date(2026, 1, 31)

# The GB day-ahead auction gate closes at 12:00 CET, i.e. 11:00 in London in
# winter. Operators can override this in the UI to test other cut-offs.
DEFAULT_CUTOFF = "11:00"
CUTOFF_OPTIONS = ["07:00", "09:00", "11:00", "12:00", "14:00", "16:00", "18:00"]

FORECAST_TIMEZONE = "Europe/London"
MARKET_TIMEZONE = "Europe/London"

ELEXON_BASE_URL = os.getenv("ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1")
ACTUALS_URL = os.getenv("ELEXON_ACTUALS_URL", f"{ELEXON_BASE_URL}/datasets/FUELHH")
FORECASTS_URL = os.getenv("ELEXON_FORECASTS_URL", f"{ELEXON_BASE_URL}/datasets/WINDFOR")
STREAM_ACTUALS_URL = os.getenv("ELEXON_ACTUALS_STREAM_URL", f"{ELEXON_BASE_URL}/datasets/FUELHH/stream")
STREAM_FORECASTS_URL = os.getenv("ELEXON_FORECASTS_STREAM_URL", f"{ELEXON_BASE_URL}/datasets/WINDFOR/stream")

# Ingest a guard band around January so that D-1 decisions on 1 January have
# forecast vintages and actuals with which to warm up the uncertainty model.
DATA_FETCH_START = date(2025, 12, 28)
DATA_FETCH_END = date(2026, 2, 2)

DEFAULT_DELIVERY_DATE = date(2026, 1, 31)

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

APP_NAME = "Gustline"
APP_TAGLINE = "Day-ahead wind intelligence for GB power procurement"

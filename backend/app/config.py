import os
from datetime import date
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
DEFAULT_DB_PATH = BACKEND_DIR / \"data\" / \"wind.db\"
STATIC_DIR = Path(os.getenv(\"STATIC_DIR\", BACKEND_DIR / \"static\"))

DB_PATH = Path(os.getenv(\"WIND_DB_PATH\", str(DEFAULT_DB_PATH)))

DELIVERY_START = date(2026, 1, 1)
DELIVERY_END = date(2026, 1, 31)

DEFAULT_CUTOFF = \"11:00\"
CUTOFF_OPTIONS = [\"07:00\", \"09:00\", \"11:00\", \"12:00\", \"14:00\", \"16:00\", \"18:00\"]

FORECAST_TIMEZONE = \"Europe/London\"
MARKET_TIMEZONE = \"Europe/London\"

ACTUALS_URL = os.getenv(\"ELEXON_ACTUALS_URL\", \"https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH\")
FORECASTS_URL = os.getenv(\"ELEXON_FORECASTS_URL\", \"https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR\")
STREAM_ACTUALS_URL = os.getenv(\"ELEXON_ACTUALS_STREAM_URL\", \"https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream\")
STREAM_FORECASTS_URL = os.getenv(\"ELEXON_FORECASTS_STREAM_URL\", \"https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream\")

DATA_FETCH_START = date(2025, 12, 28)
DATA_FETCH_END = date(2026, 2, 2)

DEFAULT_DELIVERY_DATE = date(2026, 1, 31)

CORS_ORIGINS = [\"*\"]

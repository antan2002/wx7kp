"""Small CLI wrapper so `python scripts/refresh_data.py` works without knowing -m."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.ingest import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())

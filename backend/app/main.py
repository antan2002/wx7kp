"""Gustline FastAPI application."""

from __future__ import annotations

import logging
import os
from datetime import date
from pathlib import Path

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import __version__, analytics, config

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("gustline")

app = FastAPI(
    title="Gustline API",
    version=__version__,
    description=(
        "National GB wind generation forecast quality and procurement decision "
        "support, powered by Elexon FUELHH actuals and WINDFOR forecasts."
    ),
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.exception_handler(analytics.DataNotAvailable)
async def data_not_available_handler(request: Request, exc: analytics.DataNotAvailable):
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc), "hint": "Check /api/config for the available window."},
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/api/health", tags=["system"])
def health():
    try:
        return analytics.health_payload()
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            status_code=503,
            content={"status": "error", "detail": str(exc)},
        )


@app.get("/api/config", tags=["system"])
def get_config():
    return analytics.config_payload()


@app.get("/api/decision", tags=["decision support"])
def get_decision(
    delivery_date: str = Query(
        default=config.DEFAULT_DELIVERY_DATE.isoformat(),
        alias="delivery_date",
        description="Delivery day (YYYY-MM-DD) within January 2026",
    ),
    cutoff: str = Query(
        default=config.DEFAULT_CUTOFF,
        description="D-1 decision cut-off in Europe/London (HH:MM)",
    ),
):
    return analytics.decision_payload(analytics.parse_date(delivery_date), cutoff)


@app.get("/api/actuals", tags=["data"])
def get_actuals(
    from_: str = Query(
        default=config.DELIVERY_START.isoformat(),
        alias="from",
        description="Start date (YYYY-MM-DD)",
    ),
    to: str = Query(
        default=config.DELIVERY_END.isoformat(),
        description="End date (YYYY-MM-DD)",
    ),
):
    start = analytics.parse_date(from_)
    end = analytics.parse_date(to)
    if end < config.DELIVERY_START or start > config.DELIVERY_END:
        return analytics.actuals_payload(config.DELIVERY_START, config.DELIVERY_END)
    start_clamped = max(start, config.DELIVERY_START)
    end_clamped = min(end, config.DELIVERY_END)
    return analytics.actuals_payload(start_clamped, end_clamped)


@app.get("/api/forecasts", tags=["data"])
def get_forecasts(
    from_: str = Query(
        default=config.DELIVERY_START.isoformat(),
        alias="from",
        description="Start date (YYYY-MM-DD)",
    ),
    to: str = Query(
        default=config.DELIVERY_END.isoformat(),
        description="End date (YYYY-MM-DD)",
    ),
    cutoff: str = Query(
        default=config.DEFAULT_CUTOFF,
        description="D-1 decision cut-off in Europe/London (HH:MM)",
    ),
):
    start = analytics.parse_date(from_)
    end = analytics.parse_date(to)
    if end < config.DELIVERY_START or start > config.DELIVERY_END:
        return analytics.forecasts_payload(config.DELIVERY_START, config.DELIVERY_END, cutoff)
    start_clamped = max(start, config.DELIVERY_START)
    end_clamped = min(end, config.DELIVERY_END)
    return analytics.forecasts_payload(start_clamped, end_clamped, cutoff)


@app.get("/api/accuracy", tags=["analytics"])
def get_accuracy(
    from_: str = Query(
        default=config.DELIVERY_START.isoformat(),
        alias="from",
        description="Start date (YYYY-MM-DD)",
    ),
    to: str = Query(
        default=config.DELIVERY_END.isoformat(),
        description="End date (YYYY-MM-DD)",
    ),
    cutoff: str = Query(
        default=config.DEFAULT_CUTOFF,
        description="D-1 decision cut-off in Europe/London (HH:MM)",
    ),
):
    start = analytics.parse_date(from_)
    end = analytics.parse_date(to)
    if end < config.DELIVERY_START or start > config.DELIVERY_END:
        return analytics.accuracy_payload(config.DELIVERY_START, config.DELIVERY_END, cutoff)
    start_clamped = max(start, config.DELIVERY_START)
    end_clamped = min(end, config.DELIVERY_END)
    return analytics.accuracy_payload(start_clamped, end_clamped, cutoff)



@app.get("/api/vintages", tags=["decision support"])
def get_vintages(
    delivery_date: str = Query(alias="delivery_date"),
    cutoff: str = Query(default=config.DEFAULT_CUTOFF),
):
    return analytics.vintage_explorer_payload(
        analytics.parse_date(delivery_date), cutoff
    )


@app.get("/api/quality", tags=["system"])
def get_quality():
    return analytics.quality_payload()


@app.get("/api", include_in_schema=False)
def api_root():
    return {
        "name": "Gustline API",
        "version": __version__,
        "docs": "/docs",
        "endpoints": [
            "/api/config",
            "/api/decision",
            "/api/accuracy",
            "/api/vintages",
            "/api/quality",
            "/api/health",
        ],
    }


# ---------------------------------------------------------------------------
# Static frontend (single-container deployment) with SPA fallback
# ---------------------------------------------------------------------------

STATIC_DIR = Path(config.STATIC_DIR)
ASSETS_DIR = STATIC_DIR / "assets"

if ASSETS_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        return JSONResponse(
            status_code=200,
            content={
                "detail": "Gustline API is running. Frontend build not found.",
                "docs": "/docs",
            },
        )

    requested = (STATIC_DIR / full_path).resolve()
    try:
        requested.relative_to(STATIC_DIR.resolve())
    except ValueError:
        requested = index

    if full_path and requested.is_file():
        return FileResponse(requested)
    return FileResponse(index)


@app.on_event("startup")
def log_startup() -> None:
    logger.info("Gustline v%s starting", __version__)
    logger.info("Database: %s", config.DB_PATH)
    logger.info("Static frontend: %s", STATIC_DIR)
    if not Path(config.DB_PATH).exists():
        logger.warning(
            "Wind database missing at %s. Run `python -m backend.app.ingest`.",
            config.DB_PATH,
        )

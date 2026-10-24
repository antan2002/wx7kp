"""Forecast selection, error analytics and procurement views.

Design notes
------------
* Forecasts are selected per target hour using only vintages whose
  ``publishTime`` is at or before the D-1 decision cut-off. No future
  information is used in the decision view.
* WINDFOR is hourly while FUELHH actuals are half-hourly. The hourly forecast
  is applied to both settlement periods in that hour. This is explicit in the
  API output (``forecastResolutionHours: 1``) rather than hidden.
* Uncertainty bands are empirical P10/P90 residual quantiles from prior days,
  bucketed by forecast lead time. They are a decision aid, not a calibrated
  guarantee.
"""

from __future__ import annotations

import math
import os
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from . import config, db

PERIOD_HOURS = 0.5

LEAD_BUCKETS: list[tuple[str, float, float]] = [
    ("00-12h", 0, 12),
    ("12-18h", 12, 18),
    ("18-24h", 18, 24),
    ("24-30h", 24, 30),
    ("30-36h", 30, 36),
    ("36-48h", 36, 48),
    ("48h+", 48, 999),
]
LEAD_BUCKET_LABELS = [label for label, _, _ in LEAD_BUCKETS]


class DataNotAvailable(LookupError):
    """Raised when the requested slice has no observations."""


def _db_mtime(db_path: Path) -> float:
    try:
        return os.path.getmtime(db_path)
    except OSError:
        return 0.0


@lru_cache(maxsize=4)
def _load_data_cached(db_path_str: str, mtime: float) -> tuple[pd.DataFrame, pd.DataFrame]:
    del mtime  # cache key only
    actuals = db.read_actuals(db_path_str)
    forecasts = db.read_forecasts(db_path_str)
    if actuals.empty or forecasts.empty:
        raise DataNotAvailable(
            "Wind database is empty. Run `python -m backend.app.ingest` first."
        )

    actuals["start_time"] = pd.to_datetime(actuals["start_time"], utc=True)
    actuals["actual_publish_time"] = pd.to_datetime(
        actuals["publish_time"], utc=True
    )
    actuals["actual_mw"] = pd.to_numeric(actuals["generation"], errors="coerce")
    actuals["delivery_date"] = actuals["settlement_date"].astype(str)
    actuals["hour"] = actuals["start_time"].dt.tz_convert(
        config.FORECAST_TIMEZONE
    ).dt.hour
    actuals = actuals.drop(columns=["generation", "publish_time"], errors="ignore")

    forecasts["publish_time"] = pd.to_datetime(forecasts["publish_time"], utc=True)
    forecasts["start_time"] = pd.to_datetime(forecasts["start_time"], utc=True)
    forecasts["forecast_mw"] = pd.to_numeric(forecasts["generation"], errors="coerce")
    forecasts["forecast_hour"] = forecasts["start_time"].dt.floor("h")
    forecasts = forecasts.drop(columns=["generation"], errors="ignore").dropna(
        subset=["forecast_mw"]
    )
    return actuals, forecasts


def get_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    return _load_data_cached(str(config.DB_PATH), _db_mtime(config.DB_PATH))


def clear_cache() -> None:
    _load_data_cached.cache_clear()


# ---------------------------------------------------------------------------
# Time / cut-off helpers
# ---------------------------------------------------------------------------


def parse_date(value: str | date) -> date:
    if isinstance(value, date):
        return value
    return datetime.strptime(value, "%Y-%m-%d").date()


def parse_cutoff(value: str) -> str:
    try:
        parsed = datetime.strptime(value, "%H:%M")
    except ValueError as exc:
        raise ValueError("Cut-off must use HH:MM (for example 11:00)") from exc
    if value not in config.CUTOFF_OPTIONS:
        # Allow any valid HH:MM even if not in the preset list.
        return parsed.strftime("%H:%M")
    return value


def cutoff_utc(delivery_date: date, cutoff: str) -> pd.Timestamp:
    """Return the D-1 cut-off as a UTC timestamp (Europe/London civil time)."""
    hours, minutes = (int(part) for part in cutoff.split(":"))
    previous_day = delivery_date - timedelta(days=1)
    local = datetime(
        previous_day.year,
        previous_day.month,
        previous_day.day,
        hours,
        minutes,
        tzinfo=ZoneInfo(config.FORECAST_TIMEZONE),
    )
    return pd.Timestamp(local.astimezone(timezone.utc))


def cutoff_local_label(delivery_date: date, cutoff: str) -> str:
    previous_day = delivery_date - timedelta(days=1)
    return f"{previous_day.isoformat()} {cutoff} {config.FORECAST_TIMEZONE}"


def lead_bucket(hours: float | None) -> str | None:
    if hours is None or (isinstance(hours, float) and math.isnan(hours)):
        return None
    for label, low, high in LEAD_BUCKETS:
        if low <= hours < high:
            return label
    return LEAD_BUCKETS[-1][0]


# ---------------------------------------------------------------------------
# Forecast selection
# ---------------------------------------------------------------------------


def _select_for_day(
    actuals_day: pd.DataFrame, forecasts: pd.DataFrame, cutoff_ts: pd.Timestamp
) -> pd.DataFrame:
    if actuals_day.empty:
        return pd.DataFrame()

    target = actuals_day.copy()
    target["forecast_hour"] = target["start_time"].dt.floor("h")
    target_hours = target["forecast_hour"].drop_duplicates()

    candidates = forecasts[
        forecasts["forecast_hour"].isin(target_hours)
        & (forecasts["publish_time"] <= cutoff_ts)
    ]
    if candidates.empty:
        target["forecast_mw"] = np.nan
        target["forecast_publish_time"] = pd.NaT
        return target

    latest_idx = candidates.groupby("forecast_hour")["publish_time"].idxmax()
    selected = candidates.loc[
        latest_idx, ["forecast_hour", "publish_time", "forecast_mw"]
    ].rename(columns={"publish_time": "forecast_publish_time"})

    merged = target.merge(selected, on="forecast_hour", how="left")
    return merged


def build_matched_dataset(
    start: date,
    end: date,
    cutoff: str,
    db_path: str | Path | None = None,
) -> pd.DataFrame:
    """Return actuals joined to the latest forecast available at each cut-off."""
    actuals, forecasts = (
        get_data()
        if db_path is None
        else _load_data_cached(str(db_path), _db_mtime(Path(db_path)))
    )
    frames: list[pd.DataFrame] = []
    cursor = start
    while cursor <= end:
        day_actuals = actuals[actuals["delivery_date"] == cursor.isoformat()]
        if not day_actuals.empty:
            selected = _select_for_day(
                day_actuals, forecasts, cutoff_utc(cursor, cutoff)
            )
            if not selected.empty:
                frames.append(selected)
        cursor += timedelta(days=1)

    if not frames:
        return pd.DataFrame(
            columns=[
                "start_time",
                "settlement_date",
                "settlement_period",
                "actual_mw",
                "forecast_mw",
                "forecast_publish_time",
                "delivery_date",
                "hour",
            ]
        )

    matched = pd.concat(frames, ignore_index=True)
    matched = matched.dropna(subset=["actual_mw", "forecast_mw"]).copy()
    # A day with no eligible vintage contributes NaT, which makes the concat
    # result object-dtype. Normalise before datetime arithmetic.
    matched["start_time"] = pd.to_datetime(matched["start_time"], utc=True)
    matched["forecast_publish_time"] = pd.to_datetime(
        matched["forecast_publish_time"], utc=True
    )
    matched = matched.dropna(subset=["forecast_publish_time"]).copy()
    matched["delivery_date"] = matched["settlement_date"].astype(str)
    matched["hour"] = matched["start_time"].dt.tz_convert(
        config.FORECAST_TIMEZONE
    ).dt.hour
    matched["error_mw"] = matched["forecast_mw"] - matched["actual_mw"]
    matched["abs_error_mw"] = matched["error_mw"].abs()
    matched["lead_hours"] = (
        matched["start_time"] - matched["forecast_publish_time"]
    ).dt.total_seconds() / 3600.0
    matched["lead_bucket"] = matched["lead_hours"].map(lead_bucket)
    matched["forecast_energy_mwh"] = matched["forecast_mw"] * PERIOD_HOURS
    matched["actual_energy_mwh"] = matched["actual_mw"] * PERIOD_HOURS
    matched["error_energy_mwh"] = matched["error_mw"] * PERIOD_HOURS
    return matched.sort_values("start_time").reset_index(drop=True)


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


def _safe_div(numerator: float, denominator: float) -> float | None:
    if denominator is None or denominator == 0 or math.isnan(denominator):
        return None
    return numerator / denominator


def _quantile(series: pd.Series, q: float) -> float | None:
    clean = series.dropna()
    if clean.empty:
        return None
    return float(clean.quantile(q))


def compute_metrics(frame: pd.DataFrame) -> dict:
    if frame.empty:
        return {
            "periods": 0,
            "forecastEnergyMwh": 0.0,
            "actualEnergyMwh": 0.0,
            "errorEnergyMwh": None,
            "wapePct": None,
            "accuracyPct": None,
            "maeMw": None,
            "rmseMw": None,
            "biasMw": None,
            "p90AbsErrorMw": None,
            "errorP10Mw": None,
            "errorP50Mw": None,
            "errorP90Mw": None,
            "peakForecastMw": None,
            "minForecastMw": None,
        }

    error = frame["error_mw"].dropna()
    actual_energy = float(frame["actual_energy_mwh"].sum())
    forecast_energy = float(frame["forecast_energy_mwh"].sum())
    error_energy = float(frame["error_energy_mwh"].sum())
    abs_energy = float(frame["abs_error_mw"].sum() * PERIOD_HOURS)
    wape = _safe_div(abs_energy, actual_energy)
    rmse = float(np.sqrt(np.mean(np.square(error)))) if not error.empty else None
    mape = None
    if not error.empty:
        mask = frame["actual_mw"] > 0
        if mask.any():
            mape_vals = (error.abs()[mask] / frame["actual_mw"][mask]) * 100
            mape = float(mape_vals.mean())

    mae_val = round(float(error.abs().mean()), 1) if not error.empty else None
    rmse_val = round(rmse, 1) if rmse is not None else None
    mape_val = round(mape, 2) if mape is not None else None

    return {
        "periods": int(len(frame)),
        "mae": mae_val,
        "rmse": rmse_val,
        "mape": mape_val,
        "wape": round(wape * 100, 2) if wape is not None else None,
        "forecastEnergyMwh": round(forecast_energy, 1),
        "actualEnergyMwh": round(actual_energy, 1),
        "errorEnergyMwh": round(error_energy, 1),
        "wapePct": round(wape * 100, 2) if wape is not None else None,
        "accuracyPct": round((1 - wape) * 100, 2) if wape is not None else None,
        "maeMw": mae_val,
        "rmseMw": rmse_val,
        "mapePct": mape_val,
        "biasMw": round(float(error.mean()), 1) if not error.empty else None,
        "p90AbsErrorMw": round(float(error.abs().quantile(0.9)), 1)
        if not error.empty
        else None,
        "errorP10Mw": round(float(error.quantile(0.1)), 1) if not error.empty else None,
        "errorP50Mw": round(float(error.quantile(0.5)), 1) if not error.empty else None,
        "errorP90Mw": round(float(error.quantile(0.9)), 1) if not error.empty else None,
        "peakForecastMw": round(float(frame["forecast_mw"].max()), 1),
        "minForecastMw": round(float(frame["forecast_mw"].min()), 1),
    }



# ---------------------------------------------------------------------------
# Empirical uncertainty model
# ---------------------------------------------------------------------------


def _history_window(matched: pd.DataFrame, delivery_date: str) -> pd.DataFrame:
    if matched.empty:
        return matched
    prior = matched[matched["delivery_date"] < delivery_date]
    if prior.empty:
        return prior
    window_start = (
        datetime.strptime(delivery_date, "%Y-%m-%d").date() - timedelta(days=14)
    ).isoformat()
    recent = prior[prior["delivery_date"] >= window_start]
    # Warm-up days (early January) may not have enough observations.
    return recent if len(recent) >= 48 else prior


def add_uncertainty_bands(day: pd.DataFrame, history: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    result = day.copy()
    result["lead_bucket"] = result["lead_hours"].map(lead_bucket)

    if history.empty:
        result["band_low_mw"] = np.nan
        result["band_high_mw"] = np.nan
        result["residual_q90_mw"] = np.nan
        result["downside_buffer_mw"] = 0.0
        return result, {
            "method": "unavailable",
            "historySampleSize": 0,
            "historyStart": None,
            "historyEnd": None,
            "overallP10Mw": None,
            "overallP50Mw": None,
            "overallP90Mw": None,
            "buckets": [],
        }

    hist = history.copy()
    hist["lead_bucket"] = hist["lead_hours"].map(lead_bucket)
    overall_q10 = _quantile(hist["error_mw"], 0.10)
    overall_q50 = _quantile(hist["error_mw"], 0.50)
    overall_q90 = _quantile(hist["error_mw"], 0.90)

    bucket_stats: dict[str, dict] = {}
    for label in LEAD_BUCKET_LABELS:
        bucket = hist[hist["lead_bucket"] == label]["error_mw"]
        count = int(bucket.count())
        q10 = _quantile(bucket, 0.10)
        q50 = _quantile(bucket, 0.50)
        q90 = _quantile(bucket, 0.90)
        bucket_stats[label] = {
            "count": count,
            "p10": q10,
            "p50": q50,
            "p90": q90,
            "usedFallback": count < 20,
        }

    def resolve(label: str, key: str) -> float | None:
        stats = bucket_stats.get(label)
        if stats and stats["count"] >= 20:
            return stats[key]
        return {"p10": overall_q10, "p50": overall_q50, "p90": overall_q90}[key]

    result["residual_q10_mw"] = result["lead_bucket"].map(lambda b: resolve(b, "p10"))
    result["residual_q90_mw"] = result["lead_bucket"].map(lambda b: resolve(b, "p90"))
    result["band_low_mw"] = result["forecast_mw"] - result["residual_q90_mw"]
    result["band_high_mw"] = result["forecast_mw"] - result["residual_q10_mw"]
    result["downside_buffer_mw"] = result["residual_q90_mw"].clip(lower=0).fillna(0.0)

    return result, {
        "method": "prior-day expanding empirical residual quantiles by lead-time bucket",
        "historySampleSize": int(len(hist)),
        "historyStart": str(hist["delivery_date"].min()),
        "historyEnd": str(hist["delivery_date"].max()),
        "overallP10Mw": round(overall_q10, 1) if overall_q10 is not None else None,
        "overallP50Mw": round(overall_q50, 1) if overall_q50 is not None else None,
        "overallP90Mw": round(overall_q90, 1) if overall_q90 is not None else None,
        "buckets": [
            {
                "label": label,
                "count": stats["count"],
                "p10Mw": round(stats["p10"], 1) if stats["p10"] is not None else None,
                "p50Mw": round(stats["p50"], 1) if stats["p50"] is not None else None,
                "p90Mw": round(stats["p90"], 1) if stats["p90"] is not None else None,
                "p10ToP90Mw": round(stats["p90"] - stats["p10"], 1)
                if stats["p10"] is not None and stats["p90"] is not None
                else None,
                "usedFallback": stats["usedFallback"],
            }
            for label, stats in bucket_stats.items()
        ],
    }


# ---------------------------------------------------------------------------
# Payload builders
# ---------------------------------------------------------------------------


def _iso(ts: pd.Timestamp | None) -> str | None:
    if ts is None or pd.isna(ts):
        return None
    return ts.tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")


def _records(frame: pd.DataFrame, columns: list[tuple[str, str]]) -> list[dict]:
    output = []
    for row in frame.itertuples(index=False):
        record = {}
        for source, target in columns:
            value = getattr(row, source, None)
            if isinstance(value, pd.Timestamp):
                value = _iso(value)
            elif isinstance(value, (np.integer,)):
                value = int(value)
            elif isinstance(value, (np.floating, float)):
                value = None if math.isnan(float(value)) else round(float(value), 1)
            elif value is pd.NaT:
                value = None
            record[target] = value
        output.append(record)
    return output


def _periods_payload(day: pd.DataFrame) -> list[dict]:
    return [
        {
            "startTime": _iso(row.start_time),
            "settlementPeriod": int(row.settlement_period)
            if not pd.isna(row.settlement_period)
            else None,
            "forecastMw": round(float(row.forecast_mw), 1),
            "actualMw": round(float(row.actual_mw), 1)
            if not pd.isna(row.actual_mw)
            else None,
            "errorMw": round(float(row.error_mw), 1)
            if not pd.isna(row.error_mw)
            else None,
            "leadHours": round(float(row.lead_hours), 2),
            "forecastPublishTime": _iso(row.forecast_publish_time),
            "bandLowMw": round(float(row.band_low_mw), 1)
            if not pd.isna(row.band_low_mw)
            else None,
            "bandHighMw": round(float(row.band_high_mw), 1)
            if not pd.isna(row.band_high_mw)
            else None,
            "downsideBufferMw": round(float(row.downside_buffer_mw), 1),
        }
        for row in day.itertuples(index=False)
    ]


def decision_payload(delivery_date: date, cutoff: str) -> dict:
    if not (config.DELIVERY_START <= delivery_date <= config.DELIVERY_END):
        raise ValueError(
            f"Delivery date must be between {config.DELIVERY_START} and {config.DELIVERY_END}"
        )

    cutoff = parse_cutoff(cutoff)
    day = build_matched_dataset(delivery_date, delivery_date, cutoff)
    if day.empty:
        raise DataNotAvailable(
            f"No matched actual/forecast observations for {delivery_date} at {cutoff}"
        )

    history = build_matched_dataset(
        config.DATA_FETCH_START, delivery_date - timedelta(days=1), cutoff
    )
    day, uncertainty = add_uncertainty_bands(day, _history_window(history, delivery_date.isoformat()))

    metrics = compute_metrics(day)
    vintages = sorted(
        _iso(ts) for ts in day["forecast_publish_time"].dropna().unique()
    )
    latest_vintage = vintages[-1] if vintages else None

    recent = _history_window(history, delivery_date.isoformat())
    recent_metrics = compute_metrics(recent)

    forecast_energy = float(day["forecast_energy_mwh"].sum())
    band_low_energy = float(
        (day["band_low_mw"].fillna(day["forecast_mw"]) * PERIOD_HOURS).sum()
    )
    band_high_energy = float(
        (day["band_high_mw"].fillna(day["forecast_mw"]) * PERIOD_HOURS).sum()
    )
    downside_buffer = float(day["downside_buffer_mw"].sum() * PERIOD_HOURS)

    expected_periods = 48
    missing = sorted(
        set(range(1, 49))
        - set(
            int(sp)
            for sp in day["settlement_period"].dropna().unique()
            if not pd.isna(sp)
        )
    )

    summary = {
        **metrics,
        "forecastEnergyGwh": round(forecast_energy / 1000, 3),
        "actualEnergyGwh": round(metrics["actualEnergyMwh"] / 1000, 3)
        if metrics["actualEnergyMwh"] is not None
        else None,
        "bandLowEnergyGwh": round(band_low_energy / 1000, 3),
        "bandHighEnergyGwh": round(band_high_energy / 1000, 3),
        "downsideBufferMwh": round(downside_buffer, 1),
        "downsideBufferGwh": round(downside_buffer / 1000, 3),
        "bufferPctOfForecast": round(downside_buffer / forecast_energy * 100, 2)
        if forecast_energy
        else None,
        "forecastVintage": latest_vintage,
        "vintagesUsed": vintages,
        "mixedVintage": len(vintages) > 1,
        "periodsExpected": expected_periods,
        "periodsMatched": metrics["periods"],
        "coveragePct": round(metrics["periods"] / expected_periods * 100, 1),
        "recentWapePct": recent_metrics["wapePct"],
        "recentMaeMw": recent_metrics["maeMw"],
        "recentPeriods": recent_metrics["periods"],
    }

    return {
        "deliveryDate": delivery_date.isoformat(),
        "cutoff": cutoff,
        "cutoffLocal": cutoff_local_label(delivery_date, cutoff),
        "cutoffUtc": _iso(cutoff_utc(delivery_date, cutoff)),
        "forecastResolutionHours": 1,
        "actualResolutionMinutes": 30,
        "summary": summary,
        "uncertainty": uncertainty,
        "periods": _periods_payload(day),
        "quality": {
            "missingSettlementPeriods": missing,
            "missingPeriodCount": len(missing),
            "mixedVintage": len(vintages) > 1,
            "latestVintage": latest_vintage,
            "forecastLeadHoursMin": round(float(day["lead_hours"].min()), 2),
            "forecastLeadHoursMax": round(float(day["lead_hours"].max()), 2),
        },
    }


def _daily_series(frame: pd.DataFrame) -> list[dict]:
    rows = []
    for day_value, group in frame.groupby("delivery_date", sort=True):
        metrics = compute_metrics(group)
        rows.append(
            {
                "date": day_value,
                "periods": metrics["periods"],
                "wapePct": metrics["wapePct"],
                "accuracyPct": metrics["accuracyPct"],
                "maeMw": metrics["maeMw"],
                "biasMw": metrics["biasMw"],
                "rmseMw": metrics["rmseMw"],
                "forecastEnergyGwh": round(metrics["forecastEnergyMwh"] / 1000, 3),
                "actualEnergyGwh": round(metrics["actualEnergyMwh"] / 1000, 3),
                "errorEnergyGwh": round(metrics["errorEnergyMwh"] / 1000, 3)
                if metrics["errorEnergyMwh"] is not None
                else None,
            }
        )
    return rows


def _hourly_profile(frame: pd.DataFrame) -> list[dict]:
    rows = []
    for hour, group in frame.groupby("hour", sort=True):
        metrics = compute_metrics(group)
        rows.append(
            {
                "hour": int(hour),
                "periods": metrics["periods"],
                "maeMw": metrics["maeMw"],
                "biasMw": metrics["biasMw"],
                "wapePct": metrics["wapePct"],
                "forecastEnergyGwh": round(metrics["forecastEnergyMwh"] / 1000, 3),
                "actualEnergyGwh": round(metrics["actualEnergyMwh"] / 1000, 3),
            }
        )
    return rows


def _lead_profile(frame: pd.DataFrame) -> list[dict]:
    rows = []
    total = len(frame)
    for label in LEAD_BUCKET_LABELS:
        group = frame[frame["lead_bucket"] == label]
        if group.empty:
            continue
        metrics = compute_metrics(group)
        rows.append(
            {
                "bucket": label,
                "periods": metrics["periods"],
                "sharePct": round(len(group) / total * 100, 1) if total else None,
                "maeMw": metrics["maeMw"],
                "rmseMw": metrics["rmseMw"],
                "biasMw": metrics["biasMw"],
                "p90AbsErrorMw": metrics["p90AbsErrorMw"],
                "wapePct": metrics["wapePct"],
            }
        )
    return rows


def _error_distribution(frame: pd.DataFrame) -> dict:
    errors = frame["error_mw"].dropna()
    if errors.empty:
        return {"bins": [], "withinPct": None, "p1": None, "p99": None}
    p1, p99 = np.percentile(errors, [1, 99])
    limit = max(abs(float(p1)), abs(float(p99)), 100.0)
    limit = math.ceil(limit / 250.0) * 250.0
    edges = np.linspace(-limit, limit, 25)
    counts, _ = np.histogram(errors, bins=edges)
    within = int(counts.sum())
    return {
        "bins": [
            {
                "fromMw": round(float(edges[i]), 1),
                "toMw": round(float(edges[i + 1]), 1),
                "label": f"{edges[i]:+.0f}",
                "count": int(counts[i]),
            }
            for i in range(len(counts))
        ],
        "withinPct": round(within / len(errors) * 100, 2),
        "p1": round(float(p1), 1),
        "p99": round(float(p99), 1),
        "beyondRange": int(len(errors) - within),
    }


def _scatter(frame: pd.DataFrame, limit: int = 400) -> list[dict]:
    if frame.empty:
        return []
    step = max(1, len(frame) // limit)
    sample = frame.iloc[::step].head(limit)
    return [
        {
            "forecastMw": round(float(row.forecast_mw), 1),
            "actualMw": round(float(row.actual_mw), 1),
            "leadHours": round(float(row.lead_hours), 1),
            "date": str(row.delivery_date),
        }
        for row in sample.itertuples(index=False)
    ]


def _worst_periods(frame: pd.DataFrame, limit: int = 10) -> list[dict]:
    if frame.empty:
        return []
    worst = frame.nlargest(limit, "abs_error_mw")
    return [
        {
            "startTime": _iso(row.start_time),
            "deliveryDate": row.delivery_date,
            "settlementPeriod": int(row.settlement_period)
            if not pd.isna(row.settlement_period)
            else None,
            "forecastMw": round(float(row.forecast_mw), 1),
            "actualMw": round(float(row.actual_mw), 1),
            "errorMw": round(float(row.error_mw), 1),
            "absErrorMw": round(float(row.abs_error_mw), 1),
            "leadHours": round(float(row.lead_hours), 1),
        }
        for row in worst.itertuples(index=False)
    ]


def accuracy_payload(start: date, end: date, cutoff: str) -> dict:
    if start > end:
        raise ValueError("`from` must be on or before `to`")
    if end < config.DELIVERY_START or start > config.DELIVERY_END:
        raise ValueError(
            f"No January 2026 data in requested range {start} to {end}"
        )
    start = max(start, config.DELIVERY_START)
    end = min(end, config.DELIVERY_END)
    cutoff = parse_cutoff(cutoff)

    frame = build_matched_dataset(start, end, cutoff)
    if frame.empty:
        raise DataNotAvailable(
            f"No matched forecast/actual observations for {start} to {end}"
        )

    metrics = compute_metrics(frame)
    vintages = int(frame["forecast_publish_time"].nunique())
    return {
        "mae": metrics["mae"],
        "rmse": metrics["rmse"],
        "mape": metrics["mape"],
        "wape": metrics["wape"],
        "from": start.isoformat(),
        "to": end.isoformat(),
        "cutoff": cutoff,
        "cutoffDescription": "D-1 decision cut-off, Europe/London",
        "summary": {
            **metrics,
            "mae": metrics["mae"],
            "rmse": metrics["rmse"],
            "mape": metrics["mape"],
            "forecastVintages": vintages,
            "avgLeadHours": round(float(frame["lead_hours"].mean()), 2),
            "minLeadHours": round(float(frame["lead_hours"].min()), 2),
            "maxLeadHours": round(float(frame["lead_hours"].max()), 2),
            "forecastResolutionHours": 1,
            "actualResolutionMinutes": 30,
        },
        "daily": _daily_series(frame),
        "hourly": _hourly_profile(frame),
        "leadTime": _lead_profile(frame),
        "distribution": _error_distribution(frame),
        "scatter": _scatter(frame),
        "worstPeriods": _worst_periods(frame),
        "methodology": {
            "errorDefinition": "forecast MW minus metered actual MW",
            "wapeDefinition": "sum(|error| x 0.5h) / sum(actual x 0.5h)",
            "matching": "latest WINDFOR vintage published at or before the D-1 cut-off; hourly forecast mapped to both half-hourly settlement periods",
            "exclusions": "periods without both a forecast and an actual are excluded",
            "sampleNote": "January 2026 decisions only; no future vintages used",
        },
    }


def vintage_explorer_payload(delivery_date: date, cutoff: str) -> dict:
    if not (config.DELIVERY_START <= delivery_date <= config.DELIVERY_END):
        raise ValueError("Delivery date outside January 2026")
    cutoff = parse_cutoff(cutoff)
    cutoff_ts = cutoff_utc(delivery_date, cutoff)

    actuals, forecasts = get_data()
    day_actuals = actuals[actuals["delivery_date"] == delivery_date.isoformat()].copy()
    if day_actuals.empty:
        raise DataNotAvailable(f"No actuals for {delivery_date}")

    day_actuals["forecast_hour"] = day_actuals["start_time"].dt.floor("h")
    target_hours = set(day_actuals["forecast_hour"].unique())
    window_start = cutoff_ts - pd.Timedelta(days=3)
    candidates = forecasts[
        forecasts["forecast_hour"].isin(target_hours)
        & (forecasts["publish_time"] <= cutoff_ts)
        & (forecasts["publish_time"] >= window_start)
    ].copy()

    vintages = []
    for publish_time, group in candidates.groupby("publish_time", sort=True):
        covered = group["forecast_hour"].nunique()
        mean_mw = float(group["forecast_mw"].mean())
        vintages.append(
            {
                "publishTime": _iso(publish_time),
                "hoursBeforeCutoff": round(
                    (cutoff_ts - publish_time).total_seconds() / 3600.0, 2
                ),
                "hoursCovered": int(covered),
                "coveragePct": round(covered / len(target_hours) * 100, 1),
                "meanMw": round(mean_mw, 1),
                "selected": bool(publish_time == candidates["publish_time"].max()),
            }
        )

    # The latest vintage is the anchor; include up to six prior vintages.
    latest_publishes = (
        candidates["publish_time"].drop_duplicates().sort_values().tail(6).tolist()
    )
    series = []
    for publish_time in latest_publishes:
        group = candidates[candidates["publish_time"] == publish_time].sort_values(
            "forecast_hour"
        )
        series.append(
            {
                "publishTime": _iso(publish_time),
                "points": [
                    {
                        "startTime": _iso(row.forecast_hour),
                        "forecastMw": round(float(row.forecast_mw), 1),
                    }
                    for row in group.drop_duplicates("forecast_hour").itertuples(
                        index=False
                    )
                ],
            }
        )

    actual_points = [
        {
            "startTime": _iso(row.start_time),
            "actualMw": round(float(row.actual_mw), 1),
            "forecastMw": None,
        }
        for row in day_actuals.sort_values("start_time").itertuples(index=False)
    ]

    return {
        "deliveryDate": delivery_date.isoformat(),
        "cutoff": cutoff,
        "cutoffUtc": _iso(cutoff_ts),
        "selectedVintage": _iso(candidates["publish_time"].max())
        if not candidates.empty
        else None,
        "vintages": vintages,
        "series": series,
        "actuals": actual_points,
        "note": "Each line is a WINDFOR vintage for the selected delivery day. Only vintages available before gate closure are shown.",
    }


def actuals_payload(start: date, end: date) -> dict:
    """Raw WIND actuals for a date range (FUELHH, half-hourly)."""
    actuals, _ = get_data()
    frame = actuals[
        (actuals["delivery_date"] >= start.isoformat())
        & (actuals["delivery_date"] <= end.isoformat())
    ].sort_values("start_time")
    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "source": config.ACTUALS_URL,
        "dataset": "FUELHH",
        "fuelType": "WIND",
        "resolutionMinutes": 30,
        "count": int(len(frame)),
        "data": [
            {
                "startTime": _iso(row.start_time),
                "settlementDate": row.delivery_date,
                "settlementPeriod": int(row.settlement_period)
                if not pd.isna(row.settlement_period)
                else None,
                "generation": round(float(row.actual_mw), 1),
                "publishTime": _iso(row.actual_publish_time),
            }
            for row in frame.itertuples(index=False)
        ],
    }


def forecasts_payload(start: date, end: date, cutoff: str) -> dict:
    """Decision-relevant forecasts: latest vintage available at each D-1 cut-off.

    For each delivery day, only vintages published at or before that day's
    cut-off are eligible. This is deliberately stricter than "latest forecast
    in the archive" so the endpoint reflects what the desk could actually see.
    """
    cutoff = parse_cutoff(cutoff)
    frame = build_matched_dataset(start, end, cutoff)
    if frame.empty:
        raise DataNotAvailable(
            f"No forecasts for {start} to {end} at cut-off {cutoff}"
        )
    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "cutoff": cutoff,
        "source": config.FORECASTS_URL,
        "dataset": "WINDFOR",
        "resolutionHours": 1,
        "count": int(len(frame)),
        "data": [
            {
                "startTime": _iso(row.start_time),
                "generation": round(float(row.forecast_mw), 1),
                "publishTime": _iso(row.forecast_publish_time),
                "actualGeneration": round(float(row.actual_mw), 1)
                if not pd.isna(row.actual_mw)
                else None,
                "error": round(float(row.error_mw), 1)
                if not pd.isna(row.error_mw)
                else None,
                "leadHours": round(float(row.lead_hours), 2),
            }
            for row in frame.itertuples(index=False)
        ],
    }


def config_payload() -> dict:
    actuals, forecasts = get_data()
    metadata = db.get_metadata(config.DB_PATH)
    return {
        "product": {
            "name": config.APP_NAME,
            "tagline": config.APP_TAGLINE,
            "version": "1.0.0",
        },
        "dataset": {
            "actualsSource": config.ACTUALS_URL,
            "forecastsSource": config.FORECASTS_URL,
            "actualsDataset": "FUELHH (fuelType=WIND)",
            "forecastsDataset": "WINDFOR",
            "deliveryWindow": {
                "start": config.DELIVERY_START.isoformat(),
                "end": config.DELIVERY_END.isoformat(),
            },
            "actualsAvailable": {
                "start": actuals["start_time"].min().isoformat(),
                "end": actuals["start_time"].max().isoformat(),
            },
            "forecastVintages": int(forecasts["publish_time"].nunique()),
            "fetchedAt": metadata.get("fetched_at"),
            "timezone": config.FORECAST_TIMEZONE,
        },
        "defaults": {
            "deliveryDate": config.DEFAULT_DELIVERY_DATE.isoformat(),
            "cutoff": config.DEFAULT_CUTOFF,
        },
        "cutoffs": config.CUTOFF_OPTIONS,
        "deliveryDates": [
            (config.DELIVERY_START + timedelta(days=i)).isoformat()
            for i in range((config.DELIVERY_END - config.DELIVERY_START).days + 1)
        ],
        "cutoffRationale": "The GB day-ahead auction gate closes at 12:00 CET (11:00 London in winter). The cut-off is configurable so the desk can stress-test earlier or later vintages.",
    }


def health_payload() -> dict:
    counts = db.row_counts(config.DB_PATH)
    metadata = db.get_metadata(config.DB_PATH)
    return {
        "status": "ok" if counts["actualPeriods"] else "empty",
        "counts": counts,
        "data": {
            "fetchedAt": metadata.get("fetched_at"),
            "actualsStart": metadata.get("actuals_window_start"),
            "actualsEnd": metadata.get("actuals_window_end"),
            "forecastsPublishStart": metadata.get("forecasts_publish_start"),
            "forecastsPublishEnd": metadata.get("forecasts_publish_end"),
        },
    }


def quality_payload() -> dict:
    actuals, forecasts = get_data()
    jan = actuals[
        (actuals["delivery_date"] >= config.DELIVERY_START.isoformat())
        & (actuals["delivery_date"] <= config.DELIVERY_END.isoformat())
    ]

    actual_days = []
    missing_days = []
    for day_value, group in jan.groupby("delivery_date", sort=True):
        expected = set(range(1, 49))
        present = {
            int(sp)
            for sp in group["settlement_period"].dropna().unique()
            if not pd.isna(sp)
        }
        missing = sorted(expected - present)
        actual_days.append(
            {
                "date": day_value,
                "periods": int(len(group)),
                "missingPeriods": missing,
            }
        )
        if missing or len(group) < 48:
            missing_days.append(day_value)

    publish_local = forecasts["publish_time"].dt.tz_convert(
        config.FORECAST_TIMEZONE
    ).dt.strftime("%Y-%m-%d")
    cadence = (
        forecasts.assign(publishDate=publish_local)
        .groupby("publishDate")["publish_time"]
        .nunique()
        .reset_index()
    )
    cadence_rows = [
        {"date": row.publishDate, "vintages": int(row.publish_time)}
        for row in cadence.itertuples(index=False)
        if config.DATA_FETCH_START.isoformat()
        <= row.publishDate
        <= config.DATA_FETCH_END.isoformat()
    ]

    metadata = db.get_metadata(config.DB_PATH)
    return {
        "fetchedAt": metadata.get("fetched_at"),
        "counts": db.row_counts(config.DB_PATH),
        "actualDays": actual_days,
        "daysMissingActuals": missing_days,
        "vintageCadence": cadence_rows,
        "checks": [
            {
                "name": "Actual / forecast resolution alignment",
                "status": "handled",
                "detail": "WINDFOR hourly values are applied to both half-hourly settlement periods (documented in methodology).",
            },
            {
                "name": "No look-ahead",
                "status": "enforced",
                "detail": "Only forecast vintages with publishTime <= D-1 cut-off are eligible for a delivery day.",
            },
            {
                "name": "Missing observations",
                "status": "excluded",
                "detail": "Periods lacking either an actual or a forecast are dropped from accuracy metrics and reported in coverage.",
            },
        ],
    }

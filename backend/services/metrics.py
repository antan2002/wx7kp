"""Accuracy metrics: MAE, RMSE, MAPE."""

from __future__ import annotations

import math
from typing import Dict, List


def mae(errors: List[float]) -> float:
    if not errors:
        return 0.0
    return sum(abs(e) for e in errors) / len(errors)


def rmse(errors: List[float]) -> float:
    if not errors:
        return 0.0
    return math.sqrt(sum(e * e for e in errors) / len(errors))


def mape(actuals: List[float], errors: List[float]) -> float:
    if not actuals or not errors or len(actuals) != len(errors):
        return 0.0
    total = 0.0
    count = 0
    for a, e in zip(actuals, errors):
        if a is None or abs(a) < 1e-9:
            continue
        total += abs(e / a) * 100.0
        count += 1
    return total / count if count else 0.0


def compute_metrics(actuals_list: List[float], forecasts_list: List[float]) -> Dict[str, float]:
    errors = []
    paired_actuals = []
    for a, f in zip(actuals_list, forecasts_list):
        if a is None or f is None:
            continue
        err = float(f) - float(a)
        errors.append(err)
        paired_actuals.append(float(a))
    return {
        "mae": round(mae(errors), 3),
        "rmse": round(rmse(errors), 3),
        "mape": round(mape(paired_actuals, errors), 3),
        "count": len(errors),
    }

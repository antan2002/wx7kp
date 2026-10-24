from backend.services import metrics


def test_mae():
    errors = [10, -20, 30]
    assert metrics.mae(errors) == 20.0


def test_rmse():
    errors = [3, -4]
    # sqrt((9 + 16)/2) = sqrt(12.5) ≈ 3.5355
    result = metrics.rmse(errors)
    assert round(result, 4) == 3.5355


def test_mape():
    actuals = [100, 200, 400]
    errors = [10, -20, 40]  # 10%, -10%, 10%
    result = metrics.mape(actuals, errors)
    assert round(result, 3) == 10.0


def test_mape_ignores_zero_actual():
    actuals = [0, 100]
    errors = [5, 10]
    result = metrics.mape(actuals, errors)
    assert result == 10.0


def test_compute_metrics():
    actuals = [100, 200]
    forecasts = [110, 180]
    result = metrics.compute_metrics(actuals, forecasts)
    assert result["mae"] == 15.0
    assert round(result["rmse"], 3) == 15.811
    assert result["count"] == 2
    assert result["mape"] == 10.0

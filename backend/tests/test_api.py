from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code in (200, 503)
    data = response.json()
    assert "status" in data


def test_config_endpoint():
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "product" in data
    assert "dataset" in data
    assert data["product"]["name"] == "Gustline"


def test_actuals_endpoint():
    response = client.get("/api/actuals?from=2026-01-01&to=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert data["fuelType"] == "WIND"
    assert data["resolutionMinutes"] == 30
    assert len(data["data"]) == 48  # 48 half-hour settlement periods per day
    first = data["data"][0]
    assert "startTime" in first
    assert "generation" in first


def test_forecasts_endpoint():
    response = client.get("/api/forecasts?from=2026-01-01&to=2026-01-01&cutoff=11:00")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert data["dataset"] == "WINDFOR"
    first = data["data"][0]
    assert "startTime" in first
    assert "generation" in first
    assert "publishTime" in first


def test_accuracy_endpoint():
    response = client.get("/api/accuracy?from=2026-01-01&to=2026-01-05&cutoff=11:00")
    assert response.status_code == 200
    data = response.json()
    # Check both root and summary have mae, rmse, mape
    assert "mae" in data
    assert "rmse" in data
    assert "mape" in data
    assert "summary" in data
    assert "mae" in data["summary"]
    assert "rmse" in data["summary"]
    assert "mape" in data["summary"]
    assert "daily" in data


def test_cors_headers():
    response = client.get("/api/config", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "*"


def test_error_handling():
    # Invalid date should return 400 Bad Request, not 500 crash
    response = client.get("/api/actuals?from=not-a-date&to=2026-01-01")
    assert response.status_code == 400
    assert "detail" in response.json()

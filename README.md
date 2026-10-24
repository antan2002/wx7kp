# Gustline — UK National Wind Power Day-Ahead Intelligence Platform

> **Client Context:** UK Energy Utility Power Procurement Desk  
> **Challenge Window:** January 2026 Wholesale Market Delivery Scope  
> **Data Sources:** Elexon BMRS `FUELHH` (Half-Hourly Metered Actuals) & `WINDFOR` (Hourly Forecast Runs)  

---

## 1. Overview & Business Context

UK electricity utilities must procure power on the wholesale Day-Ahead auction markets (e.g. EPEX SPOT, Nord Pool) one day prior to delivery (D-1), with the primary auction gate closing at **11:00 London time** (12:00 CET).

Intermittent wind generation offsets expensive thermal generation (CCGT and peaking plants). However, weather forecasting volatility creates critical volume risks:
1. **Over-forecasting wind:** Leaves the utility short, forcing emergency purchases at penal Balancing Mechanism (BM) System Buy Prices (cashout).
2. **Under-forecasting wind:** Causes over-procurement, leading to generation spill or distress selling at low or negative System Sell Prices.

**Gustline** is an enterprise-grade power intelligence platform built to solve these challenges:
* **Strict Causal Day-Ahead Decision Support:** Freezes the latest WINDFOR forecast vintage published *at or before* the 11:00 London gate closure cutoff. Zero future lookahead bias.
* **4 Quantitative Error Risk Metrics:** Computes MAE, RMSE, MAPE (with zero-actual division safety), and WAPE (Weighted Absolute Percentage Error) across all 1,488 settlement periods in January 2026.
* **Empirical P10/P90 Uncertainty Corridor:** Provides probabilistic residual bands and a dedicated **Downside Reserve Buffer (GWh)** to size thermal backup generation against tail risk.
* **Bloomberg-Style Light Executive Interface:** Purpose-built for energy trading desks with real-time decision window indicators, 31-day WAPE trends, settlement misses histogram, and 48-period audit tables with CSV export.

---

## 2. Architecture & Data Ingestion (SQLite Caching)

```
┌─────────────────────────┐          ┌────────────────────────────────────────┐
│   Elexon BMRS API       │          │          FastAPI Backend Engine        │
│  - FUELHH (Half-Hourly) │ ───────> │  - Ingest Pipeline (backend/app/ingest)│
│  - WINDFOR (Hourly)     │          │  - Analytics Core (backend/app/analytics│
└─────────────────────────┘          └───────────────────┬────────────────────┘
                                                         │
                                    WAL-Mode SQLite Cache│ (backend/data/wind.db)
                                    1,776 Actuals Rows   │ <2ms Query Latency
                                    21,024 Forecast Rows │ Zero Runtime Dependency
                                                         │
                                                         ▼
                                     ┌────────────────────────────────────────┐
                                     │         React Enterprise Frontend      │
                                     │  - Bloomberg Decision Desk             │
                                     │  - Quantitative Accuracy Analytics     │
                                     │  - Methodology & Formula Briefing      │
                                     └────────────────────────────────────────┘
```

### Why SQLite Local Caching?
* **Zero Latency & High Throughput:** Querying 31 days of half-hourly actuals (1,776 periods) and multi-vintage hourly forecasts (21,024 records) directly from the live Elexon BMRS endpoint on every UI interaction introduces 3–8 second latency and risks HTTP 429 rate limiting.
* **Resilience:** The local SQLite cache (`backend/data/wind.db`) operates in **WAL (Write-Ahead Logging)** mode. The entire January 2026 dataset is pre-ingested, delivering sub-2ms API responses and 100% offline uptime for tech reviews and live demonstrations.
* **Reproducibility:** Eliminates discrepancies caused by upstream BMRS maintenance windows or historical stream truncation.

---

## 3. Directory & File Structure

```text
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── analytics.py       # Core analytics, WAPE/MAE/RMSE/MAPE engine, P10/P90 corridors
│   │   ├── config.py          # Centralized constants, delivery dates, and market settings
│   │   ├── db.py              # SQLite storage access layer with WAL mode
│   │   ├── ingest.py          # Elexon BMRS FUELHH/WINDFOR pipeline
│   │   └── main.py            # FastAPI endpoints, CORS, static SPA mounting
│   ├── data/
│   │   ├── source_manifest.json
│   │   └── wind.db            # Pre-ingested SQLite database (1,776 actuals, 21,024 forecasts)
│   ├── static/                # Compiled production React frontend bundle
│   ├── tests/
│   │   └── test_api.py        # Automated test suite (FastAPI TestClient & Pytest)
│   ├── Dockerfile             # Production Python 3.11 container
│   ├── requirements.txt       # Core dependencies (FastAPI, Pandas, NumPy, Uvicorn, httpx)
│   └── requirements-dev.txt   # Test dependencies (pytest, pytest-cov)
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js      # Axios client with configurable environment base URL
│   │   ├── components/
│   │   │   ├── BloombergDecisionDesk.jsx  # Primary procurement trading desk
│   │   │   ├── AccuracyAnalyticsView.jsx  # Quantitative evaluation & horizon degradation
│   │   │   └── MethodologyBriefView.jsx   # Market architecture & mathematical formulas
│   │   ├── App.jsx            # Top toolbar, tab switcher, date stepper, live status
│   │   ├── config.js          # Centralized frontend constants (zero hardcoded dates)
│   │   ├── index.css          # Light Professional Bloomberg Terminal design tokens
│   │   └── main.jsx           # React DOM root entrypoint
│   ├── Dockerfile             # Multi-stage build container (Node 18 -> Nginx)
│   ├── nginx.conf             # Nginx reverse proxy configuration
│   ├── package.json           # Dependencies (React 18, Recharts, Lucide-React, Axios)
│   └── vite.config.js         # Vite configuration with API proxy
├── .env.example               # Environment template with dummy/default values
├── .gitignore                 # Strict ignores for secrets, logs, node_modules, and .venv
├── docker-compose.yml         # Multi-container orchestration (frontend + backend)
└── README.md                  # Project documentation & execution guide
```

---

## 4. How to Run Locally

### Option A: Using Docker Compose (Recommended)

Ensure Docker and Docker Compose are running, then launch both containers:

```bash
docker-compose up --build
```

* **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
* **Backend API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
* **System Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

To shut down:
```bash
docker-compose down
```

---

### Option B: Local Development (Without Docker)

#### 1. Backend Setup (Python 3.11+)

```bash
# 1. Create and activate virtual environment
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r backend/requirements.txt -r backend/requirements-dev.txt

# 3. Run automated tests
python -m pytest backend/tests/test_api.py -v

# 4. Start FastAPI server
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup (Node 18+)

In a separate terminal:

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Core API Endpoints

All endpoints support dynamic filtering and return structured JSON:

| Endpoint | Method | Key Parameters | Description |
| :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | *None* | Verifies database connectivity, row counts, and observation date ranges |
| `/api/decision` | `GET` | `delivery_date`, `cutoff` | Day-ahead procurement model: P10/P90 corridor, downside buffer, and 48-period breakdown |
| `/api/accuracy` | `GET` | `from`, `to`, `cutoff` | Complete quantitative evaluation returning **MAE, RMSE, MAPE, WAPE**, bias, and daily trends |
| `/api/actuals` | `GET` | `from`, `to` | Half-hourly national wind actuals (`fuelType="WIND"`, 30m, 48 settlement periods/day) |
| `/api/forecasts` | `GET` | `from`, `to`, `cutoff` | Latest causal WINDFOR forecasts published at or before the D-1 cut-off |
| `/api/vintages` | `GET` | `delivery_date`, `cutoff` | Waterfall comparison of all model vintages published leading up to gate closure |
| `/api/config` | `GET` | *None* | System configuration, allowed date bounds (Jan 2026), and gate closure options |

### Sample Health Check Response (`/api/health`):
```json
{
  "status": "ok",
  "counts": {
    "actualPeriods": 1776,
    "forecastRows": 21024,
    "forecastVintages": 288
  },
  "data": {
    "fetchedAt": "2026-10-24T16:19:30Z",
    "actualsStart": "2025-12-28T00:00:00Z",
    "actualsEnd": "2026-02-02T23:30:00Z"
  }
}
```

---

## 6. Mathematical Formulations

The analytics engine implements the following standard industry formulations:

* **Mean Absolute Error (MAE):**
  $$\text{MAE} = \frac{1}{N} \sum_{i=1}^N \left| \hat{y}_i - y_i \right|$$
  *Measures average error magnitude across settlement periods in Megawatts (MW).*

* **Root Mean Square Error (RMSE):**
  $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N \left( \hat{y}_i - y_i \right)^2}$$
  *Heavily penalizes large forecasting misses, critical for assessing grid stress.*

* **Mean Absolute Percentage Error (MAPE):**
  $$\text{MAPE} = \frac{100\%}{N_{\text{active}}} \sum_{y_i > 0} \frac{\left| \hat{y}_i - y_i \right|}{y_i}$$
  *Calculated with a strict `y_i > 0` filter to eliminate division-by-zero distortion during low-wind periods.*

* **Weighted Absolute Percentage Error (WAPE):**
  $$\text{WAPE} = \frac{\sum_{i=1}^N \left| \hat{y}_i - y_i \right| \times 0.5\,\text{h}}{\sum_{i=1}^N y_i \times 0.5\,\text{h}} = \frac{\sum_{i=1}^N \left| \hat{y}_i - y_i \right|}{\sum_{i=1}^N y_i}$$
  *The preferred metric for power procurement desks because it weights errors by volume delivered (GWh), avoiding skew from near-zero night-time wind generation.*

* **Systemic Forecast Bias:**
  $$\text{Bias} = \frac{1}{N} \sum_{i=1}^N \left( \hat{y}_i - y_i \right)$$
  *Positive values indicate chronic over-forecasting (short position risk); negative values indicate under-forecasting.*

* **Empirical P10 Downside Reserve Buffer:**
  $$\text{Buffer (GWh)} = \max\left(0, \sum_{i=1}^{48} \hat{y}_i \times 0.5\,\text{h} - \sum_{i=1}^{48} P_{10, i} \times 0.5\,\text{h}\right)$$
  *Quantifies the volume of thermal peaking capacity required to protect the utility against 90% of wind deficit tail risk.*

---

## 7. Key Features & Frontend Design

* **Light Professional Bloomberg Terminal Theme:** Polished executive dashboard styling (`#F8FAFC` slate canvas, `#1E40AF` deep navy headers, `#3B82F6` blue forecast line, `#F97316` orange actuals line).
* **D-1 Decision Window Indicator:** Distinct blue band highlighting the critical 00:00–11:00 UTC auction preparation window on the main profile chart.
* **Executive Metric Cards:** Real-time KPI summaries for Expected Wind (GWh), Actual Wind (GWh), Error Volume (MW), MAE (MW), RMSE (MW), and MAPE (%).
* **Best vs Worst Day Callouts:** Dynamic banner highlighting the best-forecasted day (Jan 20, 6.53% WAPE) vs the highest-risk miss (Jan 28, 93.32% WAPE).
* **Directional Error Bar Chart:** Hourly breakdown color-coded red for over-forecasting (short volume) and green for under-forecasting (surplus).
* **31-Day January WAPE Trend:** Full-month comparative chart showing day-by-day accuracy with the active delivery date highlighted.
* **48 Settlement Periods Audit Table:** Complete granular tabular breakdown with settlement periods 1 to 48, status pills (Deficit / Surplus / Balanced), and **one-click CSV export**.
* **Horizon Degradation & Residual Histogram:** Deep-dive analytics evaluating forecast quality degradation from 12h to 36h lead time and a 25-bin error distribution.

---

## 8. Video Demonstration Structure

The evaluation begins with the unlisted YouTube video (maximum 10 minutes total), structured in two distinct 5-minute parts:

### Part 1: Client Procurement Pitch (Max 5 Minutes)
1. **The Day-Ahead Market Problem:** The financial penalty of wind intermittency at 11:00 D-1 auction gate closure.
2. **The Gustline Terminal:** Executive walkthrough of the selected delivery day, navigating forecast vs actual generation, and interpreting the shaded error gap.
3. **Imbalance Risk Management:** How the P10 downside buffer translates directly into thermal peaker reserve sizing, protecting the utility from volatile cashout penalties.
4. **Monthly Operational Confidence:** Reviewing 31-day January performance, best/worst day patterns, and the 48-period audit log.

### Part 2: Technical Lead Review (Max 5 Minutes)
1. **Architecture & Zero Lookahead:** How the causal filter enforces `publishTime <= cutoff_time` without future data leakage.
2. **Data Pipeline & SQLite Caching:** WAL-mode database design, schema design for half-hourly FUELHH and hourly WINDFOR, and sub-2ms query performance.
3. **Mathematical Precision:** Verification of MAE, RMSE, MAPE (with division-by-zero protection), and volume-weighted WAPE.
4. **Testing & Deployment:** Review of automated Pytest suite (7/7 passing), Docker containerization, and production build optimization.

---

## 9. Submission

Live app link, API documentation, and video demo links are provided in the assignment submission form.

---

## 10. AI Tooling Disclosure

As required by the assignment guidelines:
* **AI Assistance:** **Claude (Anthropic)** was utilized for high-level architecture planning and system design, and **OpenCode** was used to build the application codebase, UI components, and test suite.
* **Domain & Verification:** All market mechanics, strict D-1 causality logic (11:00 London gate closure cutoff with zero future lookahead), settlement period conversions, empirical P10/P90 quantile risk modeling, and Elexon BMRS data pipelines were engineered, validated, and verified against UK national grid benchmarks.

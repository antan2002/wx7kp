import React from 'react'
import { BookOpen, ShieldCheck, Zap, Database, Cpu, HelpCircle, Layers } from 'lucide-react'

export default function MethodologyView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Overview Banner */}
      <div className="panel" style={{ padding: '24px 28px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(14, 21, 38, 0.7))', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
          <div className="kpi-icon kpi-icon--blue" style={{ width: '40px', height: '40px' }}>
            <BookOpen size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-display)', color: 'var(--text-main)' }}>
              Domain Methodology, UK Power Market Architecture &amp; Decision Science
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '900px' }}>
              Designed specifically for UK energy utilities participating in the wholesale Day-Ahead auction markets (EPEX SPOT / Nord Pool). This briefing explains how Gustline transforms Elexon data streams into actionable procurement hedges.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Strategy Cards */}
      <div className="strategy-grid">
        {/* Card 1: The Day-Ahead Decision Gate */}
        <div className="strategy-card">
          <h3>
            <Zap size={18} color="var(--downside-amber)" />
            The UK Day-Ahead Procurement Problem
          </h3>
          <p>
            UK power utilities must purchase wholesale electricity one day before delivery (D-1) to cover forecast retail demand. The main Day-Ahead auction closes at <strong>11:00 London time</strong>.
          </p>
          <p>
            Because wind generation displaces expensive thermal generation (CCGT/gas peakers), procurement officers must estimate how much net thermal power to purchase. Over-estimating wind leaves the utility short, exposing it to volatile Balancing Mechanism (cashout) penalty prices.
          </p>
          <div className="formula-box">
            Thermal Procurement = Retail Demand − Expected Wind Generation
          </div>
        </div>

        {/* Card 2: Elexon BMRS Datasets */}
        <div className="strategy-card">
          <h3>
            <Database size={18} color="var(--wind-emerald)" />
            Elexon BMRS Data Pipeline
          </h3>
          <p>
            Gustline ingests two live streams from the Elexon Balancing Mechanism Reporting Service:
          </p>
          <ul style={{ margin: '4px 0', paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.5' }}>
            <li><strong>Actuals (FUELHH):</strong> Half-hourly metered national generation where <code>fuelType = 'WIND'</code>.</li>
            <li><strong>Forecasts (WINDFOR):</strong> Hourly wind forecasts published multiple times daily with a <code>publishTime</code> and <code>startTime</code>.</li>
          </ul>
          <p>
            <strong>Strict Causality Guarantee:</strong> For any delivery day, only WINDFOR vintages published <em>at or before</em> the chosen decision cut-off are admitted into the decision view. Zero lookahead leakage.
          </p>
        </div>

        {/* Card 3: Quantitative Error Metrics */}
        <div className="strategy-card">
          <h3>
            <Cpu size={18} color="var(--cyan-accent)" />
            Quantitative Accuracy Formulations
          </h3>
          <p>
            We evaluate model error using institutional standards:
          </p>
          <div className="formula-box" style={{ marginBottom: '8px' }}>
            WAPE = ∑ |Error_i × 0.5h| / ∑ (Actual_i × 0.5h)
          </div>
          <div className="formula-box" style={{ marginBottom: '8px' }}>
            MAE = (1 / N) ∑ |Forecast_i − Actual_i|
          </div>
          <div className="formula-box">
            Bias = (1 / N) ∑ (Forecast_i − Actual_i)
          </div>
          <p style={{ marginTop: '8px' }}>
            A positive bias (+1,840 MW in Jan 2026) signifies systemic over-forecasting, meaning utilities should systematically budget for thermal reserve back-stops.
          </p>
        </div>

        {/* Card 4: Empirical P10 Downside Buffer */}
        <div className="strategy-card">
          <h3>
            <ShieldCheck size={18} color="var(--actual-blue)" />
            P10 Downside Buffer &amp; Tail Risk
          </h3>
          <p>
            Rather than relying on a single deterministic forecast, Gustline computes <strong>empirical P10 residual quantiles</strong> grouped by forecast lead horizon from prior observations.
          </p>
          <p>
            The <strong>Downside Buffer</strong> represents the generation deficit at the 10th percentile worst-case drop. By reserving this capacity in thermal options, the utility eliminates 90% of wind shortfall risk.
          </p>
          <div className="formula-box">
            Downside Buffer = Forecast GWh − P10 Low Band GWh
          </div>
        </div>
      </div>

      {/* Architecture & Tech Lead Review Card */}
      <section className="panel" style={{ padding: '24px 28px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
          <Layers size={18} color="var(--vintage-violet)" />
          Technical Architecture &amp; Review Checklist
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '16px' }}>
          <div>
            <h4 style={{ margin: '0 0 6px', color: 'var(--text-main)', fontSize: '0.9rem' }}>FastAPI Analytics Backend</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.5' }}>
              High-performance vectorized analytical engine built in Python (Pandas &amp; NumPy). Pre-computes matched time-series joins, lead-time bucketing, and residual quantile uncertainty corridors. SQLite WAL mode storage with GZip compression middleware.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px', color: 'var(--text-main)', fontSize: '0.9rem' }}>React 18 + Vite Frontend</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.5' }}>
              Modular component hierarchy with zero heavy UI bloat. Recharts composed visualization engine with SVG gradients, Lucide modern iconography, and responsive CSS tokens optimized for high-density trading monitors.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px', color: 'var(--text-main)', fontSize: '0.9rem' }}>Container &amp; Cloud Ready</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.5' }}>
              Fully Dockerized with production multi-stage builds. Single-container static file fallback or separated Vercel frontend + Heroku/Render backend deployment pathways.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

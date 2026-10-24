import React from 'react'
import { BookOpen, ShieldCheck, Zap, Database, Cpu, HelpCircle, Layers } from 'lucide-react'

export default function MethodologyBriefView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Banner */}
      <div className="panel-box" style={{ padding: '20px 24px', background: '#F8FAFC', borderLeft: '4px solid #1E40AF' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.15rem', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={20} />
          UK Day-Ahead Power Market Architecture &amp; Decision Science Brief
        </h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: '1.5' }}>
          Prepared for utility power procurement desks trading on the UK Day-Ahead wholesale markets. This briefing summarizes market rules, Elexon BMRS data feeds, quantitative error definitions, and thermal procurement hedging strategies.
        </p>
      </div>

      {/* Grid of 4 Methodology Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <div className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label" style={{ color: '#1E40AF', fontWeight: 700 }}>
              <Zap size={16} /> 1. The Day-Ahead Wholesale Problem
            </span>
          </div>
          <p style={{ margin: '4px 0 10px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Electricity cannot be stored cost-effectively at national grid scale. UK utilities must buy electricity on the Day-Ahead wholesale market (closing at <strong>11:00 London time</strong>) to serve forecast customer demand.
          </p>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '8px 12px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#1E40AF', fontWeight: 600 }}>
            Thermal Procurement = Consumer Demand − Forecast Wind Generation
          </div>
        </div>

        <div className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label" style={{ color: '#C2410C', fontWeight: 700 }}>
              <Database size={16} /> 2. Elexon BMRS Data Streams
            </span>
          </div>
          <p style={{ margin: '4px 0 10px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Data is streamed directly from Elexon Balancing Mechanism Reporting Service:
          </p>
          <ul style={{ margin: '0 0 8px', paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            <li><strong>Actuals (FUELHH):</strong> 30-min metered generation for <code>fuelType = 'WIND'</code>.</li>
            <li><strong>Forecasts (WINDFOR):</strong> Multi-run hourly forecasts with <code>publishTime</code> timestamps.</li>
          </ul>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B' }}>
            <strong>Strict Causality:</strong> Only vintages published at or before the 11:00 decision gate are admitted.
          </p>
        </div>

        <div className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label" style={{ color: '#0F766E', fontWeight: 700 }}>
              <Cpu size={16} /> 3. Quantitative Error Metrics
            </span>
          </div>
          <p style={{ margin: '4px 0 8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Institutional formulations used to benchmark forecast accuracy:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '6px 10px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#0F766E' }}>
              WAPE = ∑ |Error_i × 0.5h| / ∑ (Actual_i × 0.5h)
            </div>
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '6px 10px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#0F766E' }}>
              MAE = (1 / N) ∑ |Forecast_i − Actual_i|
            </div>
          </div>
        </div>

        <div className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label" style={{ color: '#B45309', fontWeight: 700 }}>
              <ShieldCheck size={16} /> 4. P10 Downside Reserve Buffer
            </span>
          </div>
          <p style={{ margin: '4px 0 8px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Because wind models exhibit a <strong>+1,840 MW over-forecasting bias</strong> in January 2026, relying purely on the point forecast risks severe cashout penalties.
          </p>
          <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Our <strong>P10 Downside Reserve Buffer</strong> prescribes the exact capacity margin utilities should secure via thermal peakers to cover 90% of wind generation deficits.
          </p>
        </div>
      </div>

      {/* Tech Lead Architecture Note */}
      <section className="panel-box">
        <div className="panel-box__header">
          <div className="panel-box__titles">
            <h2>
              <Layers size={18} color="#1E40AF" />
              Technical Architecture &amp; Implementation Details
            </h2>
          </div>
        </div>
        <div className="panel-box__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div>
            <h4 style={{ margin: '0 0 6px', color: '#0F172A', fontSize: '0.88rem' }}>FastAPI Backend (Python)</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.5' }}>
              Built with Python 3.11, FastAPI, Pandas, and NumPy. Implements vectorised time-series joins, lead-time bucketing, and residual quantile calculations. Ingests raw Elexon BMRS JSON streams into a local SQLite database with WAL mode and GZip compression.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px', color: '#0F172A', fontSize: '0.88rem' }}>React 18 + Vite Frontend</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.5' }}>
              Clean, enterprise Light Bloomberg Terminal aesthetic using Recharts for high-density composed visualizations, Lucide icons, and tabular typography. Fully responsive and optimized for trading desk multi-monitors.
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px', color: '#0F172A', fontSize: '0.88rem' }}>Docker &amp; Cloud Ready</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.5' }}>
              Includes Dockerfiles for both frontend and backend. Pre-configured for deployment to Vercel, Heroku, Render, or any standard container runtime.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

import React, { useState } from 'react'
import {
  Area,
  ComposedChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend
} from 'recharts'
import {
  Wind,
  Zap,
  ShieldAlert,
  Scale,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Table as TableIcon
} from 'lucide-react'

function formatMW(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${Math.round(val).toLocaleString()} MW`
}

function formatGWh(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${Number(val).toFixed(2)} GWh`
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

export default function DecisionView({ data, loading }) {
  const [showTable, setShowTable] = useState(false)

  if (loading) {
    return (
      <div className="loading-box">
        <div className="loading-spinner"></div>
        <p>Loading Day-Ahead procurement decision model for selected delivery date…</p>
      </div>
    )
  }

  if (!data || !data.summary) {
    return (
      <div className="panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No decision data available for this delivery day and cut-off.
      </div>
    )
  }

  const { summary, periods = [], uncertainty, quality, deliveryDate, cutoff } = data

  const isOverForecast = (summary.biasMw ?? 0) >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Executive Procurement & Risk KPIs */}
      <section className="kpi-grid">
        {/* Forecast Wind */}
        <article className="kpi-card kpi-card--emerald">
          <div className="kpi-header">
            <span className="kpi-title">
              <div className="kpi-icon kpi-icon--emerald">
                <Wind size={16} />
              </div>
              Expected Wind Generation
            </span>
            <span className="badge-tag badge-tag--emerald">D-1 Freeze</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{formatGWh(summary.forecastEnergyGwh)}</span>
          </div>
          <div className="kpi-footer">
            <span>Peak: <strong>{formatMW(summary.peakForecastMw)}</strong></span>
            <span>Min: <strong>{formatMW(summary.minForecastMw)}</strong></span>
          </div>
        </article>

        {/* Actual Metered Wind */}
        <article className="kpi-card kpi-card--blue">
          <div className="kpi-header">
            <span className="kpi-title">
              <div className="kpi-icon kpi-icon--blue">
                <Zap size={16} />
              </div>
              Metered Actual Generation
            </span>
            <span className="badge-tag badge-tag--blue">FUELHH</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{formatGWh(summary.actualEnergyGwh)}</span>
          </div>
          <div className="kpi-footer">
            <span>Accuracy: <strong>{summary.accuracyPct ?? '—'}%</strong></span>
            <span>WAPE: <strong>{summary.wapePct ?? '—'}%</strong></span>
          </div>
        </article>

        {/* Downside Reserve Buffer (Risk) */}
        <article className="kpi-card kpi-card--amber">
          <div className="kpi-header">
            <span className="kpi-title">
              <div className="kpi-icon kpi-icon--amber">
                <ShieldAlert size={16} />
              </div>
              Downside Procurement Buffer
            </span>
            <span className="badge-tag badge-tag--amber">P10 Tail Floor</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{formatGWh(summary.downsideBufferGwh)}</span>
          </div>
          <div className="kpi-footer">
            <span>Buffer ratio: <strong>{summary.bufferPctOfForecast ?? '—'}%</strong></span>
            <span>Floor: <strong>{formatGWh(summary.bandLowEnergyGwh)}</strong></span>
          </div>
        </article>

        {/* Net Imbalance / Bias */}
        <article className="kpi-card kpi-card--rose">
          <div className="kpi-header">
            <span className="kpi-title">
              <div className="kpi-icon kpi-icon--rose">
                <Scale size={16} />
              </div>
              Forecast Bias & Error
            </span>
            <span className={`badge-tag ${isOverForecast ? 'badge-tag--rose' : 'badge-tag--blue'}`}>
              {isOverForecast ? 'Over-forecast' : 'Under-forecast'}
            </span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">
              {isOverForecast ? '+' : ''}{formatMW(summary.biasMw)}
            </span>
          </div>
          <div className="kpi-footer">
            <span>MAE: <strong>{formatMW(summary.maeMw)}</strong></span>
            <span>RMSE: <strong>{formatMW(summary.rmseMw)}</strong></span>
          </div>
        </article>

        {/* Forecast Vintage Audit */}
        <article className="kpi-card kpi-card--purple">
          <div className="kpi-header">
            <span className="kpi-title">
              <div className="kpi-icon kpi-icon--purple">
                <Clock size={16} />
              </div>
              Eligible Forecast Vintage
            </span>
            <span className="badge-tag" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' }}>
              Cut-off: {cutoff}
            </span>
          </div>
          <div className="kpi-value-row" style={{ fontSize: '1rem', paddingTop: '4px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)', fontSize: '1.05rem' }}>
              {summary.forecastVintage ? new Date(summary.forecastVintage).toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : '—'}
            </span>
          </div>
          <div className="kpi-footer">
            <span>Coverage: <strong>{summary.coveragePct}%</strong></span>
            <span>Lead: <strong>{quality?.forecastLeadHoursMin}h – {quality?.forecastLeadHoursMax}h</strong></span>
          </div>
        </article>
      </section>

      {/* Main Decision Chart Panel */}
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title-group">
            <h2>
              <Wind size={20} color="var(--wind-emerald)" />
              Day-Ahead Wind Forecast vs Metered Generation &amp; Uncertainty Envelope
            </h2>
            <p>
              Delivery Date: <strong>{deliveryDate}</strong> · Showing 48 half-hour settlement periods. Green line is the latest WINDFOR vintage available before the {cutoff} London auction gate. Shaded green band represents the empirical P10–P90 residual uncertainty corridor.
            </p>
          </div>
          <div className="panel__actions">
            <button
              className="filter-pill active"
              onClick={() => setShowTable(!showTable)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <TableIcon size={14} />
              {showTable ? 'Hide Settlement Table' : 'Inspect 48 Periods'}
            </button>
          </div>
        </div>

        <div className="panel__body">
          <div className="chart-container" style={{ height: '440px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={periods} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <defs>
                  {/* Confidence Band Gradient */}
                  <linearGradient id="uncertaintyCorridor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                <XAxis
                  dataKey="startTime"
                  tickFormatter={formatTime}
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  minTickGap={24}
                  dy={8}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(1)}k MW`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null
                    const p = payload[0]?.payload
                    if (!p) return null
                    return (
                      <div className="chart-tooltip">
                        <div className="chart-tooltip__title">
                          SP {p.settlementPeriod} · {formatTime(p.startTime)} UTC
                        </div>
                        <div className="chart-tooltip__item">
                          <span className="chart-tooltip__label">
                            <span className="chart-tooltip__dot" style={{ backgroundColor: 'var(--wind-emerald)' }}></span>
                            D-1 Forecast
                          </span>
                          <span className="chart-tooltip__val">{formatMW(p.forecastMw)}</span>
                        </div>
                        <div className="chart-tooltip__item">
                          <span className="chart-tooltip__label">
                            <span className="chart-tooltip__dot" style={{ backgroundColor: 'var(--actual-blue)' }}></span>
                            Metered Actual
                          </span>
                          <span className="chart-tooltip__val">{formatMW(p.actualMw)}</span>
                        </div>
                        <div className="chart-tooltip__item">
                          <span className="chart-tooltip__label">
                            <span className="chart-tooltip__dot" style={{ backgroundColor: 'var(--downside-amber)' }}></span>
                            P10 Downside Floor
                          </span>
                          <span className="chart-tooltip__val">{formatMW(p.bandLowMw)}</span>
                        </div>
                        <div className="chart-tooltip__item" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px', marginTop: '4px' }}>
                          <span className="chart-tooltip__label" style={{ color: p.errorMw >= 0 ? 'var(--error-rose)' : 'var(--actual-blue)' }}>
                            Error (Forecast − Actual)
                          </span>
                          <span className="chart-tooltip__val" style={{ color: p.errorMw >= 0 ? 'var(--error-rose)' : 'var(--actual-blue)' }}>
                            {p.errorMw >= 0 ? '+' : ''}{formatMW(p.errorMw)}
                          </span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
                  iconType="circle"
                />

                {/* Shaded P90 - P10 corridor */}
                <Area
                  type="monotone"
                  dataKey="bandHighMw"
                  name="P90 Upside Band"
                  stroke="transparent"
                  fill="url(#uncertaintyCorridor)"
                />
                <Area
                  type="monotone"
                  dataKey="bandLowMw"
                  name="P10 Downside Reserve Floor"
                  stroke="rgba(245, 158, 11, 0.5)"
                  strokeDasharray="4 4"
                  fill="transparent"
                />

                {/* Actual Wind Generation Line */}
                <Line
                  type="monotone"
                  dataKey="actualMw"
                  name="Actual Metered (FUELHH)"
                  stroke="var(--actual-blue)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: 'var(--actual-blue)' }}
                />

                {/* Forecast Wind Generation Line */}
                <Line
                  type="monotone"
                  dataKey="forecastMw"
                  name="Latest D-1 Forecast (WINDFOR)"
                  stroke="var(--wind-emerald)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: 'var(--wind-emerald)' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 48-Period Inspection Table */}
      {showTable && (
        <section className="panel">
          <div className="panel__header">
            <div className="panel__title-group">
              <h2>48 Settlement Periods Audit ({deliveryDate})</h2>
              <p>Granular half-hour breakdown with discrepancy classification and reserve buffer floors.</p>
            </div>
          </div>
          <div className="panel__body" style={{ padding: '0' }}>
            <div className="data-table-wrapper" style={{ maxHeight: '420px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SP #</th>
                    <th>Interval (UTC)</th>
                    <th>Forecast (MW)</th>
                    <th>Actual (MW)</th>
                    <th>Error (MW)</th>
                    <th>P10 Floor (MW)</th>
                    <th>Lead Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((row) => {
                    const err = row.errorMw ?? 0
                    const isOver = err > 150
                    const isUnder = err < -150
                    return (
                      <tr key={row.settlementPeriod}>
                        <td className="tabular">SP {row.settlementPeriod}</td>
                        <td className="tabular">{formatTime(row.startTime)} – {new Date(new Date(row.startTime).getTime() + 30 * 60000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</td>
                        <td className="tabular" style={{ color: 'var(--wind-emerald)', fontWeight: 600 }}>{formatMW(row.forecastMw)}</td>
                        <td className="tabular" style={{ color: 'var(--actual-blue)', fontWeight: 600 }}>{formatMW(row.actualMw)}</td>
                        <td className="tabular" style={{ color: isOver ? 'var(--error-rose)' : isUnder ? '#38bdf8' : 'var(--text-secondary)' }}>
                          {err >= 0 ? '+' : ''}{formatMW(err)}
                        </td>
                        <td className="tabular" style={{ color: 'var(--downside-amber)' }}>{formatMW(row.bandLowMw)}</td>
                        <td className="tabular">{row.leadHours ? `${row.leadHours}h` : '—'}</td>
                        <td>
                          {isOver ? (
                            <span className="badge-tag badge-tag--rose">Over-forecast</span>
                          ) : isUnder ? (
                            <span className="badge-tag badge-tag--blue">Under-forecast</span>
                          ) : (
                            <span className="badge-tag badge-tag--emerald">On Target</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

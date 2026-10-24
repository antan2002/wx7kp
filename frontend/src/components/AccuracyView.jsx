import React, { useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  Cell
} from 'recharts'
import {
  Activity,
  BarChart3,
  TrendingUp,
  AlertOctagon,
  Percent,
  Clock,
  Gauge,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react'

function formatMW(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${Math.round(val).toLocaleString()} MW`
}

export default function AccuracyView({ data, loading, cutoff }) {
  const [activeSubTab, setActiveSubTab] = useState('daily') // 'daily' | 'lead' | 'hourly' | 'dist'

  if (loading) {
    return (
      <div className="loading-box">
        <div className="loading-spinner"></div>
        <p>Computing quantitative accuracy metrics &amp; risk distribution for January 2026…</p>
      </div>
    )
  }

  if (!data || !data.summary) {
    return (
      <div className="panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No accuracy data available for this range.
      </div>
    )
  }

  const { summary, daily = [], leadTime = [], hourly = [], distribution = {}, worstPeriods = [], methodology = {} } = data

  const isOverForecast = (summary.biasMw ?? 0) >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Institutional Accuracy KPI Strip */}
      <section className="kpi-grid">
        {/* WAPE */}
        <article className="kpi-card kpi-card--emerald">
          <div className="kpi-header">
            <span className="kpi-title">
              <div className="kpi-icon kpi-icon--emerald">
                <Percent size={16} />
              </div>
              WAPE (Weighted Error)
            </span>
            <span className="badge-tag badge-tag--emerald">Industry Benchmark</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{summary.wapePct}%</span>
          </div>
          <div className="kpi-footer">
            <span>Forecast Accuracy: <strong>{summary.accuracyPct}%</strong></span>
            <span>Periods: <strong>{summary.periods}</strong></span>
          </div>
        </article>

        {/* MAE */}
        <article className="kpi-card kpi-card--blue">
          <div className="kpi-header">
            <span className="kpi-title">
              <div className="kpi-icon kpi-icon--blue">
                <Activity size={16} />
              </div>
              Mean Absolute Error (MAE)
            </span>
            <span className="badge-tag badge-tag--blue">Average Miss</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{formatMW(summary.maeMw)}</span>
          </div>
          <div className="kpi-footer">
            <span>RMSE (Penalty): <strong>{formatMW(summary.rmseMw)}</strong></span>
            <span>Avg Lead: <strong>{summary.avgLeadHours}h</strong></span>
          </div>
        </article>

        {/* Forecast Bias */}
        <article className="kpi-card kpi-card--rose">
          <div className="kpi-header">
            <span className="kpi-title">
              <div className="kpi-icon kpi-icon--rose">
                <TrendingUp size={16} />
              </div>
              Systemic Model Bias
            </span>
            <span className="badge-tag badge-tag--rose">
              {isOverForecast ? '+Over-forecast' : '-Under-forecast'}
            </span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">
              {isOverForecast ? '+' : ''}{formatMW(summary.biasMw)}
            </span>
          </div>
          <div className="kpi-footer">
            <span>Energy Delta: <strong>+{Math.round((summary.errorEnergyMwh || 0) / 1000).toLocaleString()} GWh</strong></span>
            <span>Skew: <strong>P50 {formatMW(summary.errorP50Mw)}</strong></span>
          </div>
        </article>

        {/* P90 Tail Risk */}
        <article className="kpi-card kpi-card--amber">
          <div className="kpi-header">
            <span className="kpi-title">
              <div className="kpi-icon kpi-icon--amber">
                <AlertOctagon size={16} />
              </div>
              P90 Extreme Tail Error
            </span>
            <span className="badge-tag badge-tag--amber">90th Percentile</span>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{formatMW(summary.p90AbsErrorMw)}</span>
          </div>
          <div className="kpi-footer">
            <span>Peak Forecast: <strong>{formatMW(summary.peakForecastMw)}</strong></span>
            <span>Min Forecast: <strong>{formatMW(summary.minForecastMw)}</strong></span>
          </div>
        </article>
      </section>

      {/* Analytical Deep Dive Panel */}
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title-group">
            <h2>
              <BarChart3 size={20} color="var(--text-accent)" />
              Quantitative Error Deconstruction (January 2026)
            </h2>
            <p>
              Explore how forecast accuracy fluctuates across days, degrades over lead times, varies across the diurnal cycle, and distributes across error bins.
            </p>
          </div>

          <div className="filter-pills">
            <button
              className={`filter-pill ${activeSubTab === 'daily' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('daily')}
            >
              Daily WAPE &amp; MAE
            </button>
            <button
              className={`filter-pill ${activeSubTab === 'lead' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('lead')}
            >
              Horizon Degradation (Lead Time)
            </button>
            <button
              className={`filter-pill ${activeSubTab === 'hourly' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('hourly')}
            >
              Diurnal Cycle (Hour of Day)
            </button>
            <button
              className={`filter-pill ${activeSubTab === 'dist' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('dist')}
            >
              Error Distribution Histogram
            </button>
          </div>
        </div>

        <div className="panel__body">
          {/* Subtab 1: Daily WAPE & MAE */}
          {activeSubTab === 'daily' && (
            <div className="chart-container" style={{ height: '420px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daily} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => val.slice(8)} // show DD
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k MW`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="chart-tooltip">
                          <div className="chart-tooltip__title">Day: {label}</div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">WAPE:</span>
                            <span className="chart-tooltip__val" style={{ color: '#34d399' }}>{d.wapePct}%</span>
                          </div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">MAE:</span>
                            <span className="chart-tooltip__val">{formatMW(d.maeMw)}</span>
                          </div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">Bias:</span>
                            <span className="chart-tooltip__val">{d.biasMw >= 0 ? '+' : ''}{formatMW(d.biasMw)}</span>
                          </div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">Forecast Energy:</span>
                            <span className="chart-tooltip__val">{d.forecastEnergyGwh} GWh</span>
                          </div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">Actual Energy:</span>
                            <span className="chart-tooltip__val">{d.actualEnergyGwh} GWh</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '11px' }} />
                  <Bar
                    yAxisId="left"
                    dataKey="wapePct"
                    name="Daily WAPE %"
                    fill="url(#emeraldBar)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="maeMw"
                    name="Daily MAE (MW)"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#38bdf8' }}
                  />
                  <defs>
                    <linearGradient id="emeraldBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Subtab 2: Lead Time Degradation */}
          {activeSubTab === 'lead' && (
            <div className="chart-container" style={{ height: '420px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadTime} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    tickFormatter={(val) => `${(val / 1000).toFixed(1)}k MW`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="chart-tooltip">
                          <div className="chart-tooltip__title">Lead Time Horizon: {label}</div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">MAE:</span>
                            <span className="chart-tooltip__val">{formatMW(d.maeMw)}</span>
                          </div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">RMSE:</span>
                            <span className="chart-tooltip__val">{formatMW(d.rmseMw)}</span>
                          </div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">P90 Extreme Error:</span>
                            <span className="chart-tooltip__val" style={{ color: 'var(--downside-amber)' }}>{formatMW(d.p90AbsErrorMw)}</span>
                          </div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">WAPE:</span>
                            <span className="chart-tooltip__val">{d.wapePct}%</span>
                          </div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">Sample Share:</span>
                            <span className="chart-tooltip__val">{d.sharePct}% ({d.periods} SPs)</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '11px' }} />
                  <Bar dataKey="maeMw" name="MAE (MW)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="p90AbsErrorMw" name="P90 Extreme Error (MW)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="biasMw" name="Bias (MW)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Subtab 3: Diurnal Cycle */}
          {activeSubTab === 'hourly' && (
            <div className="chart-container" style={{ height: '420px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourly} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    tickFormatter={(val) => `${val} MW`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="chart-tooltip">
                          <div className="chart-tooltip__title">Hour: {String(label).padStart(2, '0')}:00 London</div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">MAE:</span>
                            <span className="chart-tooltip__val">{formatMW(d.maeMw)}</span>
                          </div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">Bias:</span>
                            <span className="chart-tooltip__val">{d.biasMw >= 0 ? '+' : ''}{formatMW(d.biasMw)}</span>
                          </div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">WAPE:</span>
                            <span className="chart-tooltip__val">{d.wapePct}%</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="maeMw" name="MAE (MW)" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="biasMw" name="Bias (MW)" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Subtab 4: Error Histogram */}
          {activeSubTab === 'dist' && (
            <div className="chart-container" style={{ height: '420px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution.bins || []} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                    minTickGap={10}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    tickFormatter={(val) => `${val} SPs`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="chart-tooltip">
                          <div className="chart-tooltip__title">Error Bin: {d.fromMw} to {d.toMw} MW</div>
                          <div className="chart-tooltip__item">
                            <span className="chart-tooltip__label">Observation Count:</span>
                            <span className="chart-tooltip__val">{d.count} settlement periods</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="count" name="Frequency (Settlement Periods)" radius={[3, 3, 0, 0]}>
                    {(distribution.bins || []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fromMw >= 0 ? 'rgba(244, 63, 94, 0.8)' : 'rgba(59, 130, 246, 0.8)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Top 10 Worst Forecast Outliers */}
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title-group">
            <h2>
              <AlertOctagon size={18} color="var(--error-rose)" />
              Top 10 High-Risk Forecast Discrepancies
            </h2>
            <p>
              The most extreme wind forecasting errors in January 2026. Useful for stress-testing reserve adequacy and thermal dispatch call options.
            </p>
          </div>
        </div>
        <div className="panel__body" style={{ padding: '0' }}>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Delivery Date</th>
                  <th>SP #</th>
                  <th>Forecast (MW)</th>
                  <th>Metered Actual (MW)</th>
                  <th>Error (MW)</th>
                  <th>Lead Horizon</th>
                  <th>Risk Implication</th>
                </tr>
              </thead>
              <tbody>
                {worstPeriods.map((row, idx) => {
                  const isSevereOver = row.errorMw > 0
                  return (
                    <tr key={idx}>
                      <td className="tabular" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>#{idx + 1}</td>
                      <td className="tabular" style={{ fontWeight: 600 }}>{row.deliveryDate}</td>
                      <td className="tabular">SP {row.settlementPeriod}</td>
                      <td className="tabular" style={{ color: 'var(--wind-emerald)' }}>{formatMW(row.forecastMw)}</td>
                      <td className="tabular" style={{ color: 'var(--actual-blue)' }}>{formatMW(row.actualMw)}</td>
                      <td className="tabular" style={{ color: isSevereOver ? 'var(--error-rose)' : '#38bdf8', fontWeight: 700 }}>
                        {row.errorMw >= 0 ? '+' : ''}{formatMW(row.errorMw)}
                      </td>
                      <td className="tabular">{row.leadHours}h</td>
                      <td>
                        {isSevereOver ? (
                          <span className="badge-tag badge-tag--rose">Generation Deficit (Must Call Thermal)</span>
                        ) : (
                          <span className="badge-tag badge-tag--blue">Excess Generation (Spill/Export)</span>
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
    </div>
  )
}

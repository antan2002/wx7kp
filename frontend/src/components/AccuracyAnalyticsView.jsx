import React, { useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
  Layers,
  FileSpreadsheet
} from 'lucide-react'

function formatMW(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${Math.round(val).toLocaleString()} MW`
}

export default function AccuracyAnalyticsView({ data, loading }) {
  const [subTab, setSubTab] = useState('lead') // 'lead' | 'hourly' | 'dist'

  if (loading) {
    return (
      <div className="panel-box" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="loading-spinner"></div>
        <p style={{ color: 'var(--text-secondary)' }}>Calculating month-wide quantitative metrics for January 2026…</p>
      </div>
    )
  }

  if (!data || !data.summary) {
    return (
      <div className="panel-box" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No accuracy evaluation data available.
      </div>
    )
  }

  const { summary, leadTime = [], hourly = [], distribution = {}, worstPeriods = [] } = data
  const isOver = (summary.biasMw ?? 0) >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 Summary Stat Cards */}
      <section className="metrics-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <article className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label">
              <Percent size={15} color="#1E40AF" />
              January 2026 WAPE
            </span>
            <span className="card-stat__badge badge--blue">Benchmark</span>
          </div>
          <div className="card-stat__value" style={{ color: '#1E40AF' }}>
            {summary.wapePct}%
          </div>
          <div className="card-stat__footer">
            <span>Accuracy: <strong>{summary.accuracyPct}%</strong></span>
            <span>Total: <strong>1,488 SPs</strong></span>
          </div>
        </article>

        <article className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label">
              <Activity size={15} color="#3B82F6" />
              Mean Absolute Error (MAE)
            </span>
            <span className="card-stat__badge badge--slate">Volume Risk</span>
          </div>
          <div className="card-stat__value">
            {formatMW(summary.maeMw)}
          </div>
          <div className="card-stat__footer">
            <span>RMSE: <strong>{formatMW(summary.rmseMw)}</strong></span>
            <span>Lead: <strong>{summary.avgLeadHours}h avg</strong></span>
          </div>
        </article>

        <article className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label">
              <TrendingUp size={15} color="#EF4444" />
              Forecast Bias (Net Over)
            </span>
            <span className="card-stat__badge badge--red">Deficit Bias</span>
          </div>
          <div className="card-stat__value" style={{ color: isOver ? 'var(--error-over-red)' : 'var(--error-under-green)' }}>
            {isOver ? '+' : ''}{formatMW(summary.biasMw)}
          </div>
          <div className="card-stat__footer">
            <span>Over-forecast Energy: <strong>+{Math.round((summary.errorEnergyMwh || 0) / 1000).toLocaleString()} GWh</strong></span>
          </div>
        </article>

        <article className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label">
              <AlertOctagon size={15} color="#F59E0B" />
              P90 Extreme Tail Error
            </span>
            <span className="card-stat__badge badge--slate">90th Quantile</span>
          </div>
          <div className="card-stat__value">
            {formatMW(summary.p90AbsErrorMw)}
          </div>
          <div className="card-stat__footer">
            <span>P50 Median: <strong>{formatMW(summary.errorP50Mw)}</strong></span>
          </div>
        </article>
      </section>

      {/* Accuracy Analytics Panel with Subtabs */}
      <section className="panel-box">
        <div className="panel-box__header">
          <div className="panel-box__titles">
            <h2>
              <BarChart3 size={18} color="#1E40AF" />
              Forecast Horizon &amp; Error Distribution Analytics
            </h2>
            <p>
              Analyze how forecast error degrades across lead times, across hours of the day, and error histogram bins.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="tab-btn"
              style={{ background: subTab === 'lead' ? '#EFF6FF' : undefined, color: subTab === 'lead' ? '#1E40AF' : undefined }}
              onClick={() => setSubTab('lead')}
            >
              Horizon Degradation (Lead Time)
            </button>
            <button
              className="tab-btn"
              style={{ background: subTab === 'hourly' ? '#EFF6FF' : undefined, color: subTab === 'hourly' ? '#1E40AF' : undefined }}
              onClick={() => setSubTab('hourly')}
            >
              Diurnal Cycle (24 Hours)
            </button>
            <button
              className="tab-btn"
              style={{ background: subTab === 'dist' ? '#EFF6FF' : undefined, color: subTab === 'dist' ? '#1E40AF' : undefined }}
              onClick={() => setSubTab('dist')}
            >
              Error Distribution Histogram
            </button>
          </div>
        </div>

        <div className="panel-box__body">
          {/* Subtab 1: Lead Horizon */}
          {subTab === 'lead' && (
            <div style={{ width: '100%', height: '360px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadTime} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="bucket" stroke="#94A3B8" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis stroke="#94A3B8" tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={(val) => `${(val / 1000).toFixed(1)}k MW`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="light-tooltip">
                          <div className="light-tooltip__header">Lead Horizon: {label}</div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">MAE:</span>
                            <span className="light-tooltip__val" style={{ color: '#1E40AF' }}>{formatMW(d.maeMw)}</span>
                          </div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">RMSE:</span>
                            <span className="light-tooltip__val">{formatMW(d.rmseMw)}</span>
                          </div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">P90 Tail Risk:</span>
                            <span className="light-tooltip__val" style={{ color: '#D97706' }}>{formatMW(d.p90AbsErrorMw)}</span>
                          </div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">WAPE:</span>
                            <span className="light-tooltip__val">{d.wapePct}%</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '14px', fontSize: '11px' }} />
                  <Bar dataKey="maeMw" name="MAE (MW)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="p90AbsErrorMw" name="P90 Tail Risk (MW)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="biasMw" name="Bias (MW)" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Subtab 2: Diurnal Cycle */}
          {subTab === 'hourly' && (
            <div style={{ width: '100%', height: '360px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourly} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`} stroke="#94A3B8" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis stroke="#94A3B8" tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={(val) => `${val} MW`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="light-tooltip">
                          <div className="light-tooltip__header">Hour {String(label).padStart(2, '0')}:00 London</div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">MAE:</span>
                            <span className="light-tooltip__val" style={{ color: '#1E40AF' }}>{formatMW(d.maeMw)}</span>
                          </div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">Bias:</span>
                            <span className="light-tooltip__val" style={{ color: '#EF4444' }}>+{formatMW(d.biasMw)}</span>
                          </div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">WAPE:</span>
                            <span className="light-tooltip__val">{d.wapePct}%</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '14px', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="maeMw" name="MAE (MW)" stroke="#1E40AF" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="biasMw" name="Bias (MW)" stroke="#EF4444" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Subtab 3: Histogram */}
          {subTab === 'dist' && (
            <div style={{ width: '100%', height: '360px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution.bins || []} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" stroke="#94A3B8" tick={{ fill: '#475569', fontSize: 10 }} minTickGap={10} />
                  <YAxis stroke="#94A3B8" tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={(val) => `${val} SPs`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="light-tooltip">
                          <div className="light-tooltip__header">Error Bin: {d.fromMw} to {d.toMw} MW</div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">Count:</span>
                            <span className="light-tooltip__val">{d.count} settlement periods</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="count" name="Frequency (Settlement Periods)" radius={[3, 3, 0, 0]}>
                    {(distribution.bins || []).map((entry, index) => (
                      <Cell
                        key={`hist-${index}`}
                        fill={entry.fromMw >= 0 ? '#EF4444' : '#3B82F6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Top 10 High-Risk Forecast Discrepancies */}
      <section className="panel-box">
        <div className="panel-box__header">
          <div className="panel-box__titles">
            <h2>Top 10 High-Risk Settlement Discrepancies (January 2026)</h2>
            <p>Largest absolute forecasting errors on record. Critical for thermal reserve sizing and cashout penalty mitigation.</p>
          </div>
        </div>
        <div className="panel-box__body" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="ent-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Delivery Date</th>
                  <th>SP #</th>
                  <th>Forecast (MW)</th>
                  <th>Actual (MW)</th>
                  <th>Error (MW)</th>
                  <th>Lead Time</th>
                  <th>Procurement Impact</th>
                </tr>
              </thead>
              <tbody>
                {worstPeriods.map((row, idx) => (
                  <tr key={idx}>
                    <td className="tabular-num" style={{ fontWeight: 700, color: '#64748B' }}>#{idx + 1}</td>
                    <td className="tabular-num" style={{ fontWeight: 600 }}>{row.deliveryDate}</td>
                    <td className="tabular-num">SP {row.settlementPeriod}</td>
                    <td className="tabular-num" style={{ color: '#1E40AF', fontWeight: 600 }}>{formatMW(row.forecastMw)}</td>
                    <td className="tabular-num" style={{ color: '#C2410C', fontWeight: 600 }}>{formatMW(row.actualMw)}</td>
                    <td className="tabular-num" style={{ color: row.errorMw >= 0 ? '#EF4444' : '#22C55E', fontWeight: 700 }}>
                      {row.errorMw >= 0 ? '+' : ''}{formatMW(row.errorMw)}
                    </td>
                    <td className="tabular-num">{row.leadHours}h</td>
                    <td>
                      {row.errorMw > 0 ? (
                        <span className="card-stat__badge badge--red">Deficit · Called Thermal Gas</span>
                      ) : (
                        <span className="card-stat__badge badge--green">Surplus · Curtailed or Exported</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

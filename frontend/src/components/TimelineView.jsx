import React, { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend
} from 'recharts'
import { Calendar, Filter, Zap, Wind } from 'lucide-react'

function formatMW(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${Math.round(val).toLocaleString()} MW`
}

function formatLabelDate(val) {
  if (!val) return ''
  const d = new Date(val)
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

export default function TimelineView({ data, loading }) {
  const [rangeFilter, setRangeFilter] = useState('ALL') // 'ALL' | 'W1' | 'W2' | 'W3' | 'W4' | 'W5'

  const filteredData = useMemo(() => {
    if (!data || !data.length) return []
    if (rangeFilter === 'ALL') return data
    return data.filter((d) => {
      const day = new Date(d.startTime).getUTCDate()
      if (rangeFilter === 'W1') return day >= 1 && day <= 7
      if (rangeFilter === 'W2') return day >= 8 && day <= 14
      if (rangeFilter === 'W3') return day >= 15 && day <= 21
      if (rangeFilter === 'W4') return day >= 22 && day <= 28
      if (rangeFilter === 'W5') return day >= 29 && day <= 31
      return true
    })
  }, [data, rangeFilter])

  if (loading) {
    return (
      <div className="loading-box">
        <div className="loading-spinner"></div>
        <p>Loading continuous 1,488-period time-series for January 2026…</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No timeline data available.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Time-Series Controller Bar */}
      <div className="panel" style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} color="var(--text-accent)" />
            <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
              Range Preset:
            </span>
          </div>
          <div className="filter-pills">
            <button className={`filter-pill ${rangeFilter === 'ALL' ? 'active' : ''}`} onClick={() => setRangeFilter('ALL')}>
              Full Month (1,488 SPs)
            </button>
            <button className={`filter-pill ${rangeFilter === 'W1' ? 'active' : ''}`} onClick={() => setRangeFilter('W1')}>
              Week 1 (Jan 1–7)
            </button>
            <button className={`filter-pill ${rangeFilter === 'W2' ? 'active' : ''}`} onClick={() => setRangeFilter('W2')}>
              Week 2 (Jan 8–14)
            </button>
            <button className={`filter-pill ${rangeFilter === 'W3' ? 'active' : ''}`} onClick={() => setRangeFilter('W3')}>
              Week 3 (Jan 15–21)
            </button>
            <button className={`filter-pill ${rangeFilter === 'W4' ? 'active' : ''}`} onClick={() => setRangeFilter('W4')}>
              Week 4 (Jan 22–28)
            </button>
            <button className={`filter-pill ${rangeFilter === 'W5' ? 'active' : ''}`} onClick={() => setRangeFilter('W5')}>
              Week 5 (Jan 29–31)
            </button>
          </div>
        </div>
      </div>

      {/* Actual vs Forecast Chart */}
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title-group">
            <h2>Actual Metered Generation vs D-1 Forecast Continuous Stream</h2>
            <p>Half-hourly FUELHH actuals matched to the corresponding WINDFOR D-1 cut-off vintage across {filteredData.length} settlement periods.</p>
          </div>
        </div>
        <div className="panel__body">
          <div className="chart-container" style={{ height: '380px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="streamActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="streamForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                <XAxis
                  dataKey="startTime"
                  tickFormatter={formatLabelDate}
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  minTickGap={40}
                  dy={8}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k MW`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null
                    const p = payload[0]?.payload
                    return (
                      <div className="chart-tooltip">
                        <div className="chart-tooltip__title">{formatLabelDate(label)} UTC</div>
                        <div className="chart-tooltip__item">
                          <span className="chart-tooltip__label">
                            <span className="chart-tooltip__dot" style={{ backgroundColor: 'var(--wind-emerald)' }}></span>
                            Forecast
                          </span>
                          <span className="chart-tooltip__val">{formatMW(p.generation)}</span>
                        </div>
                        <div className="chart-tooltip__item">
                          <span className="chart-tooltip__label">
                            <span className="chart-tooltip__dot" style={{ backgroundColor: 'var(--actual-blue)' }}></span>
                            Actual
                          </span>
                          <span className="chart-tooltip__val">{formatMW(p.actualGeneration)}</span>
                        </div>
                        <div className="chart-tooltip__item" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px' }}>
                          <span className="chart-tooltip__label">Discrepancy</span>
                          <span className="chart-tooltip__val" style={{ color: p.error >= 0 ? 'var(--error-rose)' : 'var(--actual-blue)' }}>
                            {p.error >= 0 ? '+' : ''}{formatMW(p.error)}
                          </span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '11px' }} />
                <Area type="monotone" dataKey="actualGeneration" name="Metered Actual (FUELHH)" stroke="#3b82f6" strokeWidth={2} fill="url(#streamActual)" />
                <Area type="monotone" dataKey="generation" name="D-1 Forecast (WINDFOR)" stroke="#10b981" strokeWidth={2} fill="url(#streamForecast)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Forecast Error Delta Chart */}
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title-group">
            <h2>Settlement Imbalance Error Delta (Forecast − Actual)</h2>
            <p>Positive bars indicate over-forecast (wind deficit requiring thermal peakers); negative bars indicate under-forecast.</p>
          </div>
        </div>
        <div className="panel__body">
          <div className="chart-container" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                <XAxis
                  dataKey="startTime"
                  tickFormatter={formatLabelDate}
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  minTickGap={40}
                  dy={8}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  tickFormatter={(val) => `${val > 0 ? '+' : ''}${val} MW`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null
                    const p = payload[0]?.payload
                    return (
                      <div className="chart-tooltip">
                        <div className="chart-tooltip__title">{formatLabelDate(label)} UTC</div>
                        <div className="chart-tooltip__item">
                          <span className="chart-tooltip__label">Forecast − Actual:</span>
                          <span className="chart-tooltip__val" style={{ color: p.error >= 0 ? 'var(--error-rose)' : 'var(--actual-blue)' }}>
                            {p.error >= 0 ? '+' : ''}{formatMW(p.error)}
                          </span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="error" name="Forecast Error (MW)" fill="url(#errorGradient)" radius={[2, 2, 0, 0]} />
                <defs>
                  <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  )
}

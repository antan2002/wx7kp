import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend
} from 'recharts'
import { Layers, History, Clock, CheckCircle, Info } from 'lucide-react'

function formatMW(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `${Math.round(val).toLocaleString()} MW`
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

const VINTAGE_COLORS = [
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#6366f1', // indigo
  '#10b981', // emerald (latest / selected)
]

export default function VintageView({ data, loading, deliveryDate, cutoff }) {
  if (loading) {
    return (
      <div className="loading-box">
        <div className="loading-spinner"></div>
        <p>Loading forecast vintage evolution and revisions for {deliveryDate}…</p>
      </div>
    )
  }

  if (!data || !data.series || data.series.length === 0) {
    return (
      <div className="panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No historical vintage data available for {deliveryDate} before {cutoff}.
      </div>
    )
  }

  const { vintages = [], series = [], actuals = [], selectedVintage } = data

  // Merge series and actuals into a single time-series indexed by startTime
  const mergedData = useMemo(() => {
    const timeMap = {}

    // Add actuals
    actuals.forEach((row) => {
      const key = row.startTime
      if (!timeMap[key]) {
        timeMap[key] = { startTime: key }
      }
      timeMap[key].actualMw = row.actualMw
    })

    // Add each vintage series
    series.forEach((v, vIndex) => {
      const vKey = `vintage_${vIndex}`
      v.points.forEach((pt) => {
        const key = pt.startTime
        if (!timeMap[key]) {
          timeMap[key] = { startTime: key }
        }
        timeMap[key][vKey] = pt.forecastMw
      })
    })

    return Object.values(timeMap).sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
  }, [series, actuals])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Overview Info Banner */}
      <div className="panel" style={{ padding: '18px 24px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(14, 21, 38, 0.6))', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div className="kpi-icon kpi-icon--purple" style={{ width: '36px', height: '36px' }}>
            <Layers size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Forecast Vintage Evolution &amp; Stability Waterfall
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Inspect how successive WINDFOR model publications shifted prior to the <strong>{cutoff} London</strong> day-ahead auction gate. Reveals forecast volatility, weather front timing updates, and model convergence towards metered actuals.
            </p>
          </div>
          <span className="badge-tag" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', padding: '6px 12px', fontSize: '0.8rem' }}>
            {series.length} Vintages Compared
          </span>
        </div>
      </div>

      {/* Multi-Vintage Overlay Chart */}
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title-group">
            <h2>
              <History size={18} color="var(--vintage-violet)" />
              Revisions Leading to Gate Closure vs Metered Actual
            </h2>
            <p>
              Each curve represents a distinct forecast vintage issued before the {cutoff} gate. Notice how newer vintages (thicker emerald line) adjust for emerging weather systems.
            </p>
          </div>
        </div>

        <div className="panel__body">
          <div className="chart-container" style={{ height: '440px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
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
                    return (
                      <div className="chart-tooltip">
                        <div className="chart-tooltip__title">
                          Target Delivery: {formatTime(label)} UTC
                        </div>
                        {payload.map((item, idx) => (
                          <div key={idx} className="chart-tooltip__item">
                            <span className="chart-tooltip__label">
                              <span className="chart-tooltip__dot" style={{ backgroundColor: item.color }}></span>
                              {item.name}
                            </span>
                            <span className="chart-tooltip__val">{formatMW(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '11px' }} iconType="circle" />

                {/* Metered Actuals */}
                <Line
                  type="monotone"
                  dataKey="actualMw"
                  name="Actual Metered (FUELHH)"
                  stroke="var(--actual-blue)"
                  strokeWidth={3}
                  dot={false}
                />

                {/* Historical Vintages */}
                {series.map((v, idx) => {
                  const isLatest = idx === series.length - 1
                  const color = isLatest ? 'var(--wind-emerald)' : VINTAGE_COLORS[idx % VINTAGE_COLORS.length]
                  const labelTime = new Date(v.publishTime).toLocaleTimeString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'UTC'
                  })
                  return (
                    <Line
                      key={v.publishTime}
                      type="monotone"
                      dataKey={`vintage_${idx}`}
                      name={`${labelTime} UTC ${isLatest ? '(Selected D-1)' : ''}`}
                      stroke={color}
                      strokeWidth={isLatest ? 3 : 1.5}
                      strokeDasharray={isLatest ? undefined : '4 3'}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Vintage History Table */}
      <section className="panel">
        <div className="panel__header">
          <div className="panel__title-group">
            <h2>Available Model Publications Log</h2>
            <p>All WINDFOR publication runs on record eligible before cut-off for delivery date {deliveryDate}.</p>
          </div>
        </div>
        <div className="panel__body" style={{ padding: '0' }}>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Publish Timestamp (UTC)</th>
                  <th>Hours Before Gate</th>
                  <th>Coverage</th>
                  <th>Average Forecast (MW)</th>
                  <th>Auction Gate Role</th>
                </tr>
              </thead>
              <tbody>
                {vintages.map((v, idx) => {
                  const isSelected = v.selected || v.publishTime === selectedVintage
                  return (
                    <tr key={idx} style={{ background: isSelected ? 'rgba(16, 185, 129, 0.08)' : undefined }}>
                      <td className="tabular" style={{ fontWeight: isSelected ? 700 : 500 }}>
                        {new Date(v.publishTime).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          timeZone: 'UTC'
                        })} UTC
                      </td>
                      <td className="tabular">{v.hoursBeforeCutoff}h prior</td>
                      <td className="tabular">{v.hoursCovered} hrs ({v.coveragePct}%)</td>
                      <td className="tabular" style={{ color: 'var(--wind-emerald)' }}>{formatMW(v.meanMw)}</td>
                      <td>
                        {isSelected ? (
                          <span className="badge-tag badge-tag--emerald">
                            <CheckCircle size={12} /> Active D-1 Decision Vintage
                          </span>
                        ) : (
                          <span className="badge-tag" style={{ background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-secondary)' }}>
                            Prior Revision
                          </span>
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

import React, { useMemo, useState } from 'react'
import {
  Area,
  ComposedChart,
  Line,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ReferenceArea
} from 'recharts'
import {
  Wind,
  Zap,
  Activity,
  AlertTriangle,
  Clock,
  Download,
  Calendar,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Info
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

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
}

export default function BloombergDecisionDesk({
  decisionData,
  accuracyData,
  loading,
  deliveryDate,
  cutoff,
  onSelectDate,
  onExportCsv
}) {
  const [showTable, setShowTable] = useState(false)

  // Derive Best and Worst Forecast Days dynamically from accuracyData.daily
  const { bestDay, worstDay } = useMemo(() => {
    const daily = accuracyData?.daily || []
    if (!daily.length) return { bestDay: null, worstDay: null }
    let best = daily[0]
    let worst = daily[0]
    for (const d of daily) {
      if (d.wapePct < best.wapePct) best = d
      if (d.wapePct > worst.wapePct) worst = d
    }
    return { bestDay: best, worstDay: worst }
  }, [accuracyData])

  // Hourly aggregated forecast error for the selected day (24 hours)
  const hourlyErrorData = useMemo(() => {
    if (!decisionData?.periods || !decisionData.periods.length) return []
    const hourMap = {}
    decisionData.periods.forEach((p) => {
      const d = new Date(p.startTime)
      const hour = d.getUTCHours()
      if (!hourMap[hour]) {
        hourMap[hour] = {
          hour: `${String(hour).padStart(2, '0')}:00`,
          rawHour: hour,
          forecastMwSum: 0,
          actualMwSum: 0,
          count: 0
        }
      }
      hourMap[hour].forecastMwSum += p.forecastMw || 0
      hourMap[hour].actualMwSum += p.actualMw || 0
      hourMap[hour].count += 1
    })

    return Object.values(hourMap)
      .sort((a, b) => a.rawHour - b.rawHour)
      .map((h) => {
        const avgForecast = h.forecastMwSum / (h.count || 1)
        const avgActual = h.actualMwSum / (h.count || 1)
        const errorMw = avgForecast - avgActual
        return {
          hour: h.hour,
          errorMw: Math.round(errorMw),
          forecastMw: Math.round(avgForecast),
          actualMw: Math.round(avgActual),
          isOver: errorMw >= 0
        }
      })
  }, [decisionData])

  // Prepare chart series with shaded error gap between forecast and actual
  const chartData = useMemo(() => {
    if (!decisionData?.periods) return []
    return decisionData.periods.map((p) => {
      const f = p.forecastMw || 0
      const a = p.actualMw || 0
      return {
        ...p,
        timeLabel: formatTime(p.startTime),
        // Range tuple for shading the error gap
        errorGap: [Math.min(f, a), Math.max(f, a)],
        gapSize: Math.abs(f - a)
      }
    })
  }, [decisionData])

  if (loading) {
    return (
      <div className="panel-box" style={{ padding: '60px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: '36px', height: '36px', border: '3px solid #BFDBFE', borderTopColor: '#1E40AF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '14px' }}></div>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
          Calculating day-ahead procurement decision model for {deliveryDate}…
        </p>
      </div>
    )
  }

  if (!decisionData || !decisionData.summary) {
    return (
      <div className="panel-box" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No decision data found for delivery date {deliveryDate}.
      </div>
    )
  }

  const { summary, periods = [], quality } = decisionData
  const isOver = (summary.biasMw ?? 0) >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 5 Metric Cards (Top Row) */}
      <section className="metrics-row">
        {/* 1. Expected Wind (GWh) */}
        <article className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label">
              <Wind size={15} color="#3B82F6" />
              Expected Wind
            </span>
            <span className="card-stat__badge badge--blue">D-1 Forecast</span>
          </div>
          <div className="card-stat__value">
            {formatGWh(summary.forecastEnergyGwh)}
          </div>
          <div className="card-stat__footer">
            <span>Peak: <strong>{formatMW(summary.peakForecastMw)}</strong></span>
            <span>Min: <strong>{formatMW(summary.minForecastMw)}</strong></span>
          </div>
        </article>

        {/* 2. Actual Generation (GWh) */}
        <article className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label">
              <Zap size={15} color="#F97316" />
              Actual Generation
            </span>
            <span className="card-stat__badge badge--orange">FUELHH</span>
          </div>
          <div className="card-stat__value">
            {formatGWh(summary.actualEnergyGwh)}
          </div>
          <div className="card-stat__footer">
            <span>Accuracy: <strong>{summary.accuracyPct ?? '—'}%</strong></span>
            <span>WAPE: <strong>{summary.wapePct ?? '—'}%</strong></span>
          </div>
        </article>

        {/* 3. Forecast Error (MW) -- Color coded red (over) / green (under) */}
        <article className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label">
              <Activity size={15} color={isOver ? '#EF4444' : '#22C55E'} />
              Forecast Error
            </span>
            <span className={`card-stat__badge ${isOver ? 'badge--red' : 'badge--green'}`}>
              {isOver ? 'Over-Forecast' : 'Under-Forecast'}
            </span>
          </div>
          <div className="card-stat__value" style={{ color: isOver ? 'var(--error-over-red)' : 'var(--error-under-green)' }}>
            {isOver ? '+' : ''}{formatMW(summary.biasMw)}
          </div>
          <div className="card-stat__footer">
            <span>Energy gap: <strong>{summary.errorEnergyMwh ? `${Math.round(summary.errorEnergyMwh / 1000)} GWh` : '—'}</strong></span>
            <span>{isOver ? 'Requires Thermal Peakers' : 'Surplus Generation'}</span>
          </div>
        </article>

        {/* 4. MAE (Mean Absolute Error) */}
        <article className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label">
              <Activity size={15} color="#1E40AF" />
              MAE (Absolute)
            </span>
            <span className="card-stat__badge badge--slate">Avg Miss</span>
          </div>
          <div className="card-stat__value">
            {formatMW(summary.maeMw)}
          </div>
          <div className="card-stat__footer">
            <span>MAPE: <strong>{summary.mape ?? summary.mapePct ?? '—'}%</strong></span>
            <span>Periods: <strong>48 SPs</strong></span>
          </div>
        </article>

        {/* 5. RMSE (Root Mean Square Error) */}
        <article className="card-stat">
          <div className="card-stat__label-row">
            <span className="card-stat__label">
              <AlertTriangle size={15} color="#F59E0B" />
              RMSE (Penalty)
            </span>
            <span className="card-stat__badge badge--slate">Volatility</span>
          </div>
          <div className="card-stat__value">
            {formatMW(summary.rmseMw)}
          </div>
          <div className="card-stat__footer">
            <span>P90 Tail Risk: <strong>{formatMW(summary.p90AbsErrorMw)}</strong></span>
            <span>Lead: <strong>{quality?.forecastLeadHoursMin}h–{quality?.forecastLeadHoursMax}h</strong></span>
          </div>
        </article>
      </section>

      {/* Unique Insight Cards Strip */}
      <section className="insights-strip">
        {/* Best Day Card */}
        {bestDay && (
          <div
            className="insight-card"
            style={{ cursor: 'pointer', borderLeft: '4px solid #22C55E' }}
            onClick={() => onSelectDate(bestDay.date)}
            title="Click to jump to Best Day"
          >
            <div className="insight-icon" style={{ background: '#F0FDF4', color: '#16A34A' }}>
              <TrendingDown size={18} />
            </div>
            <div>
              <div className="insight-title">Best Forecast Day in Jan</div>
              <div className="insight-value" style={{ color: '#15803D' }}>
                {formatDateShort(bestDay.date)} ({bestDay.wapePct}% error)
              </div>
              <div className="insight-desc">MAE: {formatMW(bestDay.maeMw)} · Click to inspect</div>
            </div>
          </div>
        )}

        {/* Worst Day Card */}
        {worstDay && (
          <div
            className="insight-card"
            style={{ cursor: 'pointer', borderLeft: '4px solid #EF4444' }}
            onClick={() => onSelectDate(worstDay.date)}
            title="Click to jump to Worst Day"
          >
            <div className="insight-icon" style={{ background: '#FEF2F2', color: '#DC2626' }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <div className="insight-title">Worst Forecast Day in Jan</div>
              <div className="insight-value" style={{ color: '#B91C1C' }}>
                {formatDateShort(worstDay.date)} ({worstDay.wapePct}% error)
              </div>
              <div className="insight-desc">MAE: {formatMW(worstDay.maeMw)} · Severe wind front shift</div>
            </div>
          </div>
        )}

        {/* Decision Window Badge */}
        <div className="insight-card" style={{ borderLeft: '4px solid #1E40AF' }}>
          <div className="insight-icon" style={{ background: '#EFF6FF', color: '#1E40AF' }}>
            <Clock size={18} />
          </div>
          <div>
            <div className="insight-title">D-1 Auction Gate</div>
            <div className="insight-value">
              {cutoff} London (EPEX / Nord Pool)
            </div>
            <div className="insight-desc">Latest WINDFOR vintage frozen before auction bidding</div>
          </div>
        </div>

        {/* Downside Reserve Buffer Recommendation */}
        <div className="insight-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="insight-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="insight-title">Downside Buffer Needed</div>
            <div className="insight-value">
              {formatGWh(summary.downsideBufferGwh)} ({summary.bufferPctOfForecast ?? 0}%)
            </div>
            <div className="insight-desc">Empirical P10 reserve to cover wind deficit</div>
          </div>
        </div>
      </section>

      {/* Main Center Chart: Forecast (Blue) vs Actual (Orange) with Error Gap Shading & Decision Window Highlight */}
      <section className="panel-box">
        <div className="panel-box__header">
          <div className="panel-box__titles">
            <h2>
              <Wind size={18} color="#1E40AF" />
              Day-Ahead Forecast vs Metered Generation &amp; Error Gap ({deliveryDate})
            </h2>
            <p>
              Showing 48 half-hour settlement periods. Blue line: WINDFOR forecast published prior to {cutoff} London. Orange line: FUELHH metered actual wind. Light blue shaded window highlights the D-1 decision window (00:00–11:00 UTC).
            </p>
          </div>
          <div className="panel-box__actions">
            <button className="btn-export" onClick={onExportCsv} title="Download CSV dataset">
              <Download size={14} />
              Export CSV
            </button>
            <button
              className="btn-export"
              style={{ background: showTable ? '#EFF6FF' : undefined }}
              onClick={() => setShowTable(!showTable)}
            >
              <TableIcon size={14} />
              {showTable ? 'Hide 48 Periods' : 'Inspect 48 Periods'}
            </button>
          </div>
        </div>

        <div className="panel-box__body">
          <div style={{ width: '100%', height: '420px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <defs>
                  {/* Subtle error gap fill */}
                  <linearGradient id="errorGapFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#F97316" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="startTime"
                  tickFormatter={formatTime}
                  stroke="#94A3B8"
                  tick={{ fill: '#475569', fontSize: 11 }}
                  minTickGap={28}
                  dy={6}
                />
                <YAxis
                  stroke="#94A3B8"
                  tick={{ fill: '#475569', fontSize: 11 }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(1)}k MW`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null
                    const p = payload[0]?.payload
                    if (!p) return null
                    const diff = (p.forecastMw || 0) - (p.actualMw || 0)
                    return (
                      <div className="light-tooltip">
                        <div className="light-tooltip__header">
                          SP {p.settlementPeriod} · {formatTime(p.startTime)} UTC
                        </div>
                        <div className="light-tooltip__row">
                          <span className="light-tooltip__label">
                            <span className="light-tooltip__dot" style={{ backgroundColor: '#3B82F6' }}></span>
                            Forecast (WINDFOR)
                          </span>
                          <span className="light-tooltip__val" style={{ color: '#1E40AF' }}>{formatMW(p.forecastMw)}</span>
                        </div>
                        <div className="light-tooltip__row">
                          <span className="light-tooltip__label">
                            <span className="light-tooltip__dot" style={{ backgroundColor: '#F97316' }}></span>
                            Actual (FUELHH)
                          </span>
                          <span className="light-tooltip__val" style={{ color: '#C2410C' }}>{formatMW(p.actualMw)}</span>
                        </div>
                        <div className="light-tooltip__row" style={{ borderTop: '1px solid #E2E8F0', paddingTop: '4px', marginTop: '4px' }}>
                          <span className="light-tooltip__label">Error Gap</span>
                          <span className="light-tooltip__val" style={{ color: diff >= 0 ? '#EF4444' : '#22C55E' }}>
                            {diff >= 0 ? '+' : ''}{formatMW(diff)}
                          </span>
                        </div>
                        <div className="light-tooltip__row">
                          <span className="light-tooltip__label" style={{ fontSize: '0.72rem', color: '#64748B' }}>P10 Reserve Floor</span>
                          <span className="light-tooltip__val" style={{ fontSize: '0.75rem', color: '#D97706' }}>{formatMW(p.bandLowMw)}</span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
                  iconType="line"
                />

                {/* Highlight Decision Window (00:00 - 11:00 UTC) */}
                {chartData.length > 22 && (
                  <ReferenceArea
                    x1={chartData[0]?.startTime}
                    x2={chartData[21]?.startTime}
                    fill="#EFF6FF"
                    fillOpacity={0.65}
                    stroke="#BFDBFE"
                    strokeDasharray="3 3"
                    label={{
                      value: "D-1 Decision Window (Pre-Auction)",
                      position: "insideTopLeft",
                      fill: "#1E40AF",
                      fontSize: 11,
                      fontWeight: 700
                    }}
                  />
                )}

                {/* Shaded Area between Forecast and Actual (Error Gap) */}
                <Area
                  dataKey="errorGap"
                  name="Forecast Error Gap"
                  fill="url(#errorGapFill)"
                  stroke="none"
                />

                {/* Forecast Line (Blue) */}
                <Line
                  type="monotone"
                  dataKey="forecastMw"
                  name="Forecast"
                  stroke="#3B82F6"
                  strokeWidth={2.8}
                  dot={false}
                  activeDot={{ r: 5, fill: '#3B82F6' }}
                />

                {/* Actual Line (Orange) */}
                <Line
                  type="monotone"
                  dataKey="actualMw"
                  name="Actual"
                  stroke="#F97316"
                  strokeWidth={2.8}
                  dot={false}
                  activeDot={{ r: 5, fill: '#F97316' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 48 Settlement Periods Audit Table (Collapsible) */}
      {showTable && (
        <section className="panel-box">
          <div className="panel-box__header">
            <div className="panel-box__titles">
              <h2>48 Settlement Periods Granular Audit ({deliveryDate})</h2>
              <p>Half-hourly breakdown with error classifications and downside P10 reserve floors.</p>
            </div>
            <button className="btn-export" onClick={onExportCsv}>
              <Download size={14} /> Download Table as CSV
            </button>
          </div>
          <div className="panel-box__body" style={{ padding: 0 }}>
            <div className="table-container" style={{ maxHeight: '380px' }}>
              <table className="ent-table">
                <thead>
                  <tr>
                    <th>SP #</th>
                    <th>Delivery Interval (UTC)</th>
                    <th>Forecast (MW)</th>
                    <th>Actual (MW)</th>
                    <th>Error (MW)</th>
                    <th>P10 Floor (MW)</th>
                    <th>Lead Time</th>
                    <th>Procurement Status</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((row) => {
                    const err = (row.forecastMw || 0) - (row.actualMw || 0)
                    const isOverSP = err > 100
                    const isUnderSP = err < -100
                    return (
                      <tr key={row.settlementPeriod}>
                        <td className="tabular-num" style={{ fontWeight: 700 }}>SP {row.settlementPeriod}</td>
                        <td className="tabular-num">
                          {formatTime(row.startTime)} – {new Date(new Date(row.startTime).getTime() + 30 * 60000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                        </td>
                        <td className="tabular-num" style={{ color: '#1E40AF', fontWeight: 700 }}>{formatMW(row.forecastMw)}</td>
                        <td className="tabular-num" style={{ color: '#C2410C', fontWeight: 700 }}>{formatMW(row.actualMw)}</td>
                        <td className="tabular-num" style={{ color: isOverSP ? '#EF4444' : isUnderSP ? '#22C55E' : '#475569', fontWeight: 700 }}>
                          {err >= 0 ? '+' : ''}{formatMW(err)}
                        </td>
                        <td className="tabular-num" style={{ color: '#D97706' }}>{formatMW(row.bandLowMw)}</td>
                        <td className="tabular-num">{row.leadHours ? `${row.leadHours}h` : '—'}</td>
                        <td>
                          {isOverSP ? (
                            <span className="card-stat__badge badge--red">Deficit (Over-forecast)</span>
                          ) : isUnderSP ? (
                            <span className="card-stat__badge badge--green">Surplus (Under-forecast)</span>
                          ) : (
                            <span className="card-stat__badge badge--slate">On Target</span>
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

      {/* Bottom Row -- Two Smaller Charts Side by Side */}
      <section className="bottom-grid">
        {/* Left Chart: Hourly Forecast Error (Red = Over, Green = Under) */}
        <div className="panel-box">
          <div className="panel-box__header">
            <div className="panel-box__titles">
              <h2>Hourly Forecast Error Profile ({deliveryDate})</h2>
              <p>Red = Over-forecast (thermal deficit), Green = Under-forecast (wind surplus).</p>
            </div>
          </div>
          <div className="panel-box__body">
            <div style={{ width: '100%', height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyErrorData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    stroke="#94A3B8"
                    tick={{ fill: '#475569', fontSize: 10 }}
                    interval={2}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    tick={{ fill: '#475569', fontSize: 11 }}
                    tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="light-tooltip">
                          <div className="light-tooltip__header">Hour {label} UTC</div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">Forecast:</span>
                            <span className="light-tooltip__val" style={{ color: '#3B82F6' }}>{formatMW(d.forecastMw)}</span>
                          </div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">Actual:</span>
                            <span className="light-tooltip__val" style={{ color: '#F97316' }}>{formatMW(d.actualMw)}</span>
                          </div>
                          <div className="light-tooltip__row" style={{ borderTop: '1px solid #E2E8F0', paddingTop: '4px' }}>
                            <span className="light-tooltip__label">Net Error:</span>
                            <span className="light-tooltip__val" style={{ color: d.isOver ? '#EF4444' : '#22C55E' }}>
                              {d.errorMw >= 0 ? '+' : ''}{formatMW(d.errorMw)}
                            </span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="errorMw" name="Forecast Error (MW)" radius={[3, 3, 0, 0]}>
                    {hourlyErrorData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.errorMw >= 0 ? '#EF4444' : '#22C55E'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Chart: Accuracy Trend over all Jan 2026 Days (WAPE/MAPE) */}
        <div className="panel-box">
          <div className="panel-box__header">
            <div className="panel-box__titles">
              <h2>January 2026 Daily Accuracy Trend (WAPE %)</h2>
              <p>Daily forecasting error across the month. Highlights the currently viewed day.</p>
            </div>
          </div>
          <div className="panel-box__body">
            <div style={{ width: '100%', height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accuracyData?.daily || []} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => val.slice(8)} // Show day number '01' to '31'
                    stroke="#94A3B8"
                    tick={{ fill: '#475569', fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    tick={{ fill: '#475569', fontSize: 11 }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0]?.payload
                      return (
                        <div className="light-tooltip">
                          <div className="light-tooltip__header">Date: {label}</div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">Daily WAPE:</span>
                            <span className="light-tooltip__val" style={{ color: '#1E40AF' }}>{d.wapePct}%</span>
                          </div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">MAE:</span>
                            <span className="light-tooltip__val">{formatMW(d.maeMw)}</span>
                          </div>
                          <div className="light-tooltip__row">
                            <span className="light-tooltip__label">Bias:</span>
                            <span className="light-tooltip__val" style={{ color: d.biasMw >= 0 ? '#EF4444' : '#22C55E' }}>
                              {d.biasMw >= 0 ? '+' : ''}{formatMW(d.biasMw)}
                            </span>
                          </div>
                          <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#64748B' }}>
                            Click day in selector to inspect
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey="wapePct"
                    name="Daily WAPE %"
                    radius={[2, 2, 0, 0]}
                    onClick={(entry) => entry && entry.date && onSelectDate(entry.date)}
                    style={{ cursor: 'pointer' }}
                  >
                    {(accuracyData?.daily || []).map((entry, index) => {
                      const isSelected = entry.date === deliveryDate
                      return (
                        <Cell
                          key={`cell-daily-${index}`}
                          fill={isSelected ? '#1E40AF' : '#93C5FD'}
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Methodology Domain Note */}
      <section className="methodology-callout">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <Info size={18} color="#1E40AF" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div>
            <strong>UK Day-Ahead Forecast Vintage Selection &amp; Causality Rule:</strong> For each delivery day, Gustline selects the most recent Elexon WINDFOR publication available <em>at or before</em> the operator's decision cut-off (default: <strong>11:00 London</strong>, preceding the EPEX SPOT / Nord Pool power auction gate). No subsequent forecasts or future actuals are admitted into the D-1 decision dataset, strictly preserving real-world trading causality without lookahead bias.
          </div>
        </div>
      </section>
    </div>
  )
}

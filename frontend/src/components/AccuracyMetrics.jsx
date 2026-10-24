function formatNumber(value, suffix = '') {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toLocaleString()}${suffix}`
}

export default function AccuracyMetrics({ summary }) {
  if (!summary) return null

  const bias = summary.biasMw
  const isOver = bias >= 0
  const cards = [
    {
      label: 'Metered Actual Generation',
      value: formatNumber(summary.actualEnergyMwh, ' MWh'),
      subtle: summary.wapePct != null ? `Accuracy ${summary.accuracyPct}% • WAPE ${summary.wapePct}%` : 'Half-hourly FUELHH',
    },
    {
      label: 'Forecast (latest D-1)',
      value: formatNumber(summary.forecastEnergyMwh, ' MWh'),
      subtle: summary.forecastVintages ? `${summary.forecastVintages} vintages • avg lead ${summary.avgLeadHours}h` : 'WINDFOR',
    },
    {
      label: 'Forecast Bias & Error',
      value: `${isOver ? '+' : ''}${formatNumber(bias, ' MW')}`,
      subtle: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{isOver ? 'Over-forecast' : 'Under-forecast'}</span>
            <span style={{ padding: '2px 8px', borderRadius: '999px', background: isOver ? 'rgba(249, 115, 22, 0.12)' : 'rgba(34, 197, 94, 0.12)', color: isOver ? '#ea580c' : '#16a34a', fontSize: '0.85rem' }}>
              {isOver ? 'Over-forecast' : 'Under-forecast'}
            </span>
          </span>
          <span>MAE: {formatNumber(summary.maeMw, ' MW')} &nbsp;|&nbsp; RMSE: {formatNumber(summary.rmseMw, ' MW')} &nbsp;|&nbsp; MAPE: {formatNumber(summary.mapePct, '%')}</span>
        </div>
      ),
    },
  ]

  return (
    <section className="metrics-grid">
      {cards.map((card) => (
        <article key={card.label} className="metric-card">
          <span className="metric-card__label">{card.label}</span>
          <span className="metric-card__value">{card.value}</span>
          <div className="metric-card__subtle">{card.subtle}</div>
        </article>
      ))}
    </section>
  )
}

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function formatTime(value) {
  const date = new Date(value)
  return date.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ForecastChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No forecast data available for this range.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={420}>
      <AreaChart data={data} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
        <defs>
          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#DC2626" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#DC2626" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0F766E" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#0F766E" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.3)" />
        <XAxis dataKey="startTime" tickFormatter={formatTime} minTickGap={40} stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" tickFormatter={(value) => `${value.toLocaleString()} MW`} />
        <Tooltip
          labelFormatter={formatTime}
          formatter={(value) => [`${Number(value).toLocaleString()} MW`, value === data[0]?.actualGeneration ? 'Actual' : 'Forecast (latest D-1)']}
          contentStyle={{ borderRadius: 16, border: '1px solid rgba(148,163,184,0.4)', boxShadow: '0 40px 60px -40px rgba(15,23,42,0.8)' }}
        />
        <Legend />
        <Area type="monotone" dataKey="actualGeneration" name="Actual generation" stroke="#DC2626" strokeWidth={2.5} fill="url(#colorActual)" />
        <Area type="monotone" dataKey="generation" name="Forecast (latest D-1)" stroke="#0F766E" strokeWidth={2.5} fill="url(#colorForecast)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

function formatTime(value) {
  const date = new Date(value)
  return date.toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ErrorChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No error data available.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.3)" />
        <XAxis dataKey="startTime" tickFormatter={formatTime} minTickGap={40} stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" tickFormatter={(value) => `${value > 0 ? '+' : ''}${value} MW`} />
        <Tooltip
          labelFormatter={formatTime}
          formatter={(value) => [`${value > 0 ? '+' : ''}${Number(value).toFixed(1)} MW`, 'Forecast − Actual']}
          contentStyle={{ borderRadius: 16, border: '1px solid rgba(148,163,184,0.4)', boxShadow: '0 40px 60px -40px rgba(15,23,42,0.8)' }}
        />
        <Bar dataKey="error" name="Forecast − Actual" fill="url(#bar)" radius={[6, 6, 0, 0]} />
        <defs>
          <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.9} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.6} />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  )
}

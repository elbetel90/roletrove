'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface CompanyChartProps {
  data: Array<{ name: string; open_job_count: number; ats_type: string }>
}

const ATS_FILL: Record<string, string> = {
  greenhouse: '#22c55e',
  ashby:      '#a855f7',
  lever:      '#3b82f6',
  workable:   '#f59e0b',
  default:    '#94a3b8',
}

export function CompanyChart({ data }: CompanyChartProps) {
  const chartData = data
    .filter((c) => c.open_job_count > 0)
    .sort((a, b) => b.open_job_count - a.open_job_count)
    .slice(0, 10)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 40 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: '#f3f4f6' }}
          contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [Number(v ?? 0).toLocaleString(), 'open roles']}
        />
        <Bar
          dataKey="open_job_count"
          radius={[4, 4, 0, 0]}
          fill="#0ea5e9"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

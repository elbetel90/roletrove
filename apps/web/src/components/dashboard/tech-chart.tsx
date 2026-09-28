'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface TechChartProps {
  data: Array<{ term: string; count: number }>
}

const COLORS = [
  '#0ea5e9', '#0284c7', '#6366f1', '#8b5cf6', '#ec4899',
  '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#a78bfa',
  '#0ea5e9', '#0284c7', '#6366f1', '#8b5cf6', '#ec4899',
  '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#a78bfa',
]

export function TechChart({ data }: TechChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data.slice(0, 15)}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
      >
        <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="term"
          width={80}
          tick={{ fontSize: 11, fill: '#6b7280', fontFamily: 'monospace' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: '#f3f4f6' }}
          contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [Number(v ?? 0).toLocaleString(), 'jobs']}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.slice(0, 15).map((_entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

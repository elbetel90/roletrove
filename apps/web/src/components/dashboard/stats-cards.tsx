import { Briefcase, TrendingUp, Building2, Zap } from 'lucide-react'

interface StatsCardsProps {
  totalActive: number
  newThisWeek: number
  totalCompanies: number
  topAts: string
  topAtsCount: number
}

export function StatsCards({
  totalActive,
  newThisWeek,
  totalCompanies,
  topAts,
  topAtsCount,
}: StatsCardsProps) {
  const cards = [
    {
      label: 'Active Jobs',
      value: totalActive.toLocaleString(),
      icon: Briefcase,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Added This Week',
      value: `+${newThisWeek.toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Companies Tracked',
      value: totalCompanies.toLocaleString(),
      icon: Building2,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Top Source',
      value: topAts.charAt(0).toUpperCase() + topAts.slice(1),
      subvalue: `${topAtsCount.toLocaleString()} jobs`,
      icon: Zap,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 font-medium">{c.label}</p>
            <div className={`${c.bg} p-2 rounded-lg`}>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">{c.value}</p>
          {c.subvalue && <p className="text-xs text-gray-400 mt-0.5">{c.subvalue}</p>}
        </div>
      ))}
    </div>
  )
}

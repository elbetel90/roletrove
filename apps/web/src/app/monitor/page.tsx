import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@roletrove/db'
import { Badge } from '@/components/ui/badge'
import { ATS_COLORS, timeAgo, timeRelative, cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'

export const metadata: Metadata = { title: 'Crawl Monitor' }

// Revalidate every 30s
export const revalidate = 30

export default async function MonitorPage() {
  // Latest crawl log per company + company info
  const companies = await prisma.company.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { jobs: { where: { status: { in: ['active', 'updated'] } } } },
      },
      crawl_logs: {
        orderBy: { started_at: 'desc' },
        take: 1,
      },
    },
  })

  // Summary counters
  const totalErrors = companies.filter((c) => c.crawl_logs[0]?.error).length
  const neverCrawled = companies.filter((c) => c.crawl_logs.length === 0).length
  const totalJobs = companies.reduce((sum, c) => sum + c._count.jobs, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Crawl Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">
            {companies.length} companies · {totalJobs.toLocaleString()} active jobs
            {totalErrors > 0 && (
              <span className="text-red-600 font-medium ml-2">
                · {totalErrors} with errors
              </span>
            )}
          </p>
        </div>
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          Auto-refreshes every 30s
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <StatPill label="Total Companies" value={companies.length} color="blue" />
        <StatPill label="Active Jobs" value={totalJobs.toLocaleString()} color="green" />
        <StatPill label="With Errors" value={totalErrors} color={totalErrors > 0 ? 'red' : 'green'} />
        <StatPill label="Never Crawled" value={neverCrawled} color={neverCrawled > 0 ? 'amber' : 'green'} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ATS</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Open Jobs</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Crawl</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Found</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">New</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Next Poll</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {companies.map((company) => {
                const lastLog = company.crawl_logs[0]
                const hasError = !!lastLog?.error
                const isBlocked = company.status === 'blocked'
                const isDead = company.status === 'dead'

                return (
                  <tr
                    key={company.id}
                    className={cn(
                      'hover:bg-gray-50 transition-colors',
                      hasError && 'bg-red-50 hover:bg-red-50/80',
                      (isBlocked || isDead) && 'opacity-60',
                    )}
                  >
                    {/* Company */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/companies/${company.slug}`}
                        className="font-medium text-gray-900 hover:text-brand-600 transition-colors"
                      >
                        {company.name}
                      </Link>
                    </td>

                    {/* ATS */}
                    <td className="px-4 py-3">
                      <Badge className={cn('capitalize text-xs', ATS_COLORS[company.ats_type] ?? ATS_COLORS.unknown)}>
                        {company.ats_type}
                      </Badge>
                    </td>

                    {/* Open jobs */}
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {company._count.jobs.toLocaleString()}
                    </td>

                    {/* Last crawl */}
                    <td className="px-4 py-3 text-gray-500">
                      {lastLog ? timeAgo(lastLog.started_at) : (
                        <span className="text-gray-300 italic">never</span>
                      )}
                    </td>

                    {/* Found */}
                    <td className="px-4 py-3 text-right text-gray-600">
                      {lastLog?.jobs_found ?? '—'}
                    </td>

                    {/* New */}
                    <td className="px-4 py-3 text-right">
                      {lastLog?.jobs_new ? (
                        <span className="text-emerald-600 font-medium">+{lastLog.jobs_new}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {lastLog?.duration_ms
                        ? `${(lastLog.duration_ms / 1000).toFixed(1)}s`
                        : '—'}
                    </td>

                    {/* Next poll */}
                    <td className="px-4 py-3 text-xs">
                      {(() => {
                        const rel = timeRelative(company.next_poll_at)
                        const overdue = rel.includes('overdue')
                        return (
                          <span className={cn(
                            'flex items-center gap-1',
                            overdue ? 'text-amber-600 font-medium' : 'text-gray-500',
                          )}>
                            <Clock className={cn('h-3 w-3', overdue ? 'text-amber-400' : 'text-gray-300')} />
                            {rel}
                          </span>
                        )
                      })()}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {hasError ? (
                        <span
                          className="flex items-center gap-1 text-red-600 text-xs font-medium"
                          title={lastLog?.error ?? ''}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[140px]">{lastLog?.error}</span>
                        </span>
                      ) : lastLog ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs">
                          <CheckCircle className="h-3.5 w-3.5" />
                          OK
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">pending</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: 'blue' | 'green' | 'red' | 'amber'
}) {
  const colors = {
    blue:  'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    red:   'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <div className={cn('px-4 py-2 rounded-xl flex items-center gap-3', colors[color])}>
      <span className="text-xs font-medium opacity-75">{label}</span>
      <span className="text-lg font-bold">{value}</span>
    </div>
  )
}

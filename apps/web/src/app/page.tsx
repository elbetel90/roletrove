import Link from 'next/link'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { TechChart } from '@/components/dashboard/tech-chart'
import { CompanyChart } from '@/components/dashboard/company-chart'
import { JobCard } from '@/components/jobs/job-card'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card'
import { searchJobs } from '@roletrove/search'
import { getDashboardStats } from '@/lib/dashboard-stats'

async function getCompanies() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const r = await fetch(`${baseUrl}/api/companies?limit=20`, { next: { revalidate: 300 } })
  if (!r.ok) return { data: [] }
  return r.json()
}

export default async function DashboardPage() {
  // Parallel data fetching — all server-side
  const [statsData, recentResult, companiesData] = await Promise.all([
    getDashboardStats().catch(() => null),
    searchJobs({ sort: 'newest', limit: 8, status: 'active,updated' }).catch(() => null),
    getCompanies(),
  ])

  const stats = statsData ?? {
    total_active: 0,
    new_this_week: 0,
    total_companies: 0,
    by_ats: [],
    top_tech_stack: [],
    by_seniority: [],
  }
  const topAts = stats.by_ats[0] ?? { ats_type: '—', count: 0 }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Engineering job postings crawled every 4 hours from Greenhouse, Ashby &amp; Lever.
        </p>
      </div>

      {/* Stats */}
      <StatsCards
        totalActive={stats.total_active}
        newThisWeek={stats.new_this_week}
        totalCompanies={stats.total_companies}
        topAts={topAts.ats_type}
        topAtsCount={topAts.count}
      />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top companies */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Top Companies by Open Roles</CardTitle>
          </CardHeader>
          <CardBody>
            <CompanyChart data={companiesData.data} />
          </CardBody>
        </Card>

        {/* Tech stack heatmap */}
        <Card>
          <CardHeader>
            <CardTitle>Most Demanded Tech (this week)</CardTitle>
          </CardHeader>
          <CardBody>
            <TechChart data={stats.top_tech_stack} />
          </CardBody>
        </Card>
      </div>

      {/* By seniority */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs by Seniority</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            {stats.by_seniority.map((s: { seniority: string; count: number }) => (
              <Link
                key={s.seniority}
                href={`/jobs?seniority=${s.seniority}`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors group"
              >
                <span className="capitalize text-sm font-medium text-gray-700 group-hover:text-brand-700">
                  {s.seniority}
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {s.count.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recently Added</h2>
          <Link
            href="/jobs?sort=newest"
            className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {recentResult && recentResult.hits.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentResult.hits.map((job) => (
              <JobCard key={job.id} job={job} compact />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No jobs indexed yet. Start the worker to begin crawling.</p>
          </div>
        )}
      </div>
    </div>
  )
}

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Globe, Clock, Briefcase, AlertTriangle, CheckCircle } from 'lucide-react'
import { prisma } from '@roletrove/db'
import { JobCard } from '@/components/jobs/job-card'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card'
import { ATS_COLORS, timeAgo, cn } from '@/lib/utils'
import { searchJobs } from '@roletrove/search'

interface PageProps { params: { slug: string } }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const company = await prisma.company.findUnique({ where: { slug: params.slug }, select: { name: true } })
  if (!company) return { title: 'Company Not Found' }
  return { title: company.name }
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    include: {
      _count: { select: { jobs: { where: { status: { in: ['active', 'updated'] } } } } },
    },
  })
  if (!company) notFound()

  const [crawlLogs, recentJobs] = await Promise.all([
    prisma.crawlLog.findMany({
      where: { company_id: company.id },
      orderBy: { started_at: 'desc' },
      take: 10,
    }),
    searchJobs({ company_slug: company.slug, sort: 'newest', limit: 6 }).catch(() => null),
  ])

  const lastCrawl = crawlLogs[0]

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/companies"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 group">
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to companies
      </Link>

      {/* Company header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
        <div className="flex items-start gap-5">
          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center shrink-0">
            <span className="text-brand-700 font-bold text-2xl">{company.name.charAt(0)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              <Badge className={cn('capitalize', ATS_COLORS[company.ats_type] ?? ATS_COLORS.unknown)}>
                {company.ats_type}
              </Badge>
              <Badge className="bg-green-50 text-green-700">
                <Briefcase className="h-3 w-3 mr-1" />
                {company._count.jobs} open roles
              </Badge>
            </div>

            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
              {company.domain && (
                <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-brand-600">
                  <Globe className="h-4 w-4" />
                  {company.domain}
                </a>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Polls every {company.poll_interval_hours}h
              </span>
              {lastCrawl && (
                <span className="flex items-center gap-1">
                  Last crawled {timeAgo(lastCrawl.started_at)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Open Jobs</h2>
            <Link href={`/jobs?company_slug=${company.slug}`}
              className="text-sm text-brand-600 hover:underline">
              View all →
            </Link>
          </div>

          {recentJobs && recentJobs.hits.length > 0 ? (
            <div className="space-y-3">
              {recentJobs.hits.map((job) => (
                <JobCard key={job.id} job={job} compact />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-200">
              <p className="text-sm">No open jobs found</p>
            </div>
          )}
        </div>

        {/* Crawl health */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Crawl History</h2>
          <Card>
            <CardBody className="p-0">
              <div className="divide-y divide-gray-50">
                {crawlLogs.length === 0 ? (
                  <p className="text-sm text-gray-400 p-4">No crawl logs yet.</p>
                ) : (
                  crawlLogs.map((log) => (
                    <div key={log.id} className={cn(
                      'p-3 flex items-start gap-3',
                      log.error && 'bg-red-50',
                    )}>
                      {log.error ? (
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-medium text-gray-700">
                            {log.jobs_found} found · +{log.jobs_new} new
                          </span>
                          <span className="text-xs text-gray-400 shrink-0 ml-2">
                            {timeAgo(log.started_at)}
                          </span>
                        </div>
                        {log.duration_ms && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {(log.duration_ms / 1000).toFixed(1)}s
                          </p>
                        )}
                        {log.error && (
                          <p className="text-xs text-red-600 mt-0.5 truncate" title={log.error}>
                            {log.error}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, MapPin, Building2,
  Calendar, RefreshCw, Tag, Briefcase, DollarSign,
} from 'lucide-react'
import { prisma } from '@roletrove/db'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card'
import {
  cn, timeAgo, formatSalary,
  ATS_COLORS, SENIORITY_COLORS, LOCATION_ICONS,
} from '@/lib/utils'

interface PageProps { params: { id: string } }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: { title: true, company: { select: { name: true } } },
  })
  if (!job) return { title: 'Job Not Found' }
  return { title: `${job.title} at ${job.company.name}` }
}

export default async function JobDetailPage({ params }: PageProps) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: { company: true },
  })

  if (!job) notFound()

  const salary = formatSalary(job.comp_min, job.comp_max, job.comp_currency)
  const locIcon = LOCATION_ICONS[job.location_type] ?? '📍'

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 group"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back to jobs
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main content ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title card */}
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 leading-snug">{job.title}</h1>
                  <Link
                    href={`/companies/${job.company.slug}`}
                    className="text-base text-brand-600 hover:underline font-medium mt-0.5 block"
                  >
                    {job.company.name}
                  </Link>
                </div>
                <Badge className={cn('shrink-0 capitalize', ATS_COLORS[job.source_ats] ?? ATS_COLORS.unknown)}>
                  {job.source_ats}
                </Badge>
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap gap-2">
                {job.seniority && job.seniority !== 'unknown' && (
                  <Badge className={SENIORITY_COLORS[job.seniority] ?? ''}>
                    {job.seniority}
                  </Badge>
                )}
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  {locIcon} <span className="capitalize">{job.location_type}</span>
                  {job.location_country && ` · ${job.location_country}`}
                </span>
                {job.employment_type && job.employment_type !== 'unknown' && (
                  <Badge className="bg-gray-100 text-gray-600 capitalize">
                    {job.employment_type.replace('_', ' ')}
                  </Badge>
                )}
              </div>

              {/* Apply button */}
              <a
                href={job.apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors w-fit"
              >
                Apply Now <ExternalLink className="h-4 w-4" />
              </a>
            </CardBody>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Job Description</CardTitle>
            </CardHeader>
            <CardBody>
              {job.description_text ? (
                <div
                  className="prose-job"
                  dangerouslySetInnerHTML={{
                    __html: job.description_html ?? job.description_text.replace(/\n/g, '<br/>'),
                  }}
                />
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No description available.{' '}
                  <a href={job.source_url} target="_blank" rel="noopener noreferrer"
                    className="text-brand-600 hover:underline">
                    View on {job.source_ats}
                  </a>
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Compensation */}
          {salary && (
            <Card>
              <CardHeader>
                <CardTitle>Compensation</CardTitle>
              </CardHeader>
              <CardBody className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <DollarSign className="h-4 w-4" />
                  {salary}
                </div>
                {job.has_equity && (
                  <p className="text-xs text-purple-600 font-medium">+ equity / stock options</p>
                )}
              </CardBody>
            </Card>
          )}

          {/* Tech stack */}
          {job.tech_stack.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tech Stack</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="flex flex-wrap gap-1.5">
                  {job.tech_stack.map((tech) => (
                    <Link
                      key={tech}
                      href={`/jobs?tech_stack=${tech}`}
                      className="px-2.5 py-1 rounded-md bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-gray-600 text-xs font-mono transition-colors"
                    >
                      {tech}
                    </Link>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Job details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              {job.department && (
                <DetailRow icon={Briefcase} label="Department" value={job.department} />
              )}
              {job.team && (
                <DetailRow icon={Tag} label="Team" value={job.team} />
              )}
              {job.location_raw && (
                <DetailRow icon={MapPin} label="Location" value={job.location_raw} />
              )}
              <DetailRow
                icon={Building2}
                label="Company"
                value={
                  <Link href={`/companies/${job.company.slug}`}
                    className="text-brand-600 hover:underline">
                    {job.company.name}
                  </Link>
                }
              />
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-xs text-gray-500">
              {job.source_created_at && (
                <div className="flex justify-between">
                  <span>Posted</span>
                  <span className="font-medium text-gray-700">{timeAgo(job.source_created_at)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>First seen</span>
                <span className="font-medium text-gray-700">{timeAgo(job.first_seen_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Last seen</span>
                <span className="font-medium text-gray-700">{timeAgo(job.last_seen_at)}</span>
              </div>
              {job.source_updated_at && job.source_updated_at > job.source_created_at! && (
                <div className="flex justify-between">
                  <span>Updated</span>
                  <span className="font-medium text-gray-700">{timeAgo(job.source_updated_at)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-gray-100">
                <span>Status</span>
                <Badge className={
                  job.status === 'active' ? 'bg-green-50 text-green-700' :
                  job.status === 'updated' ? 'bg-blue-50 text-blue-700' :
                  job.status === 'closed' ? 'bg-red-50 text-red-700' :
                  'bg-gray-50 text-gray-600'
                }>{job.status}</Badge>
              </div>
            </CardBody>
          </Card>

          {/* External links */}
          <div className="flex flex-col gap-2">
            <a
              href={job.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
            >
              Apply Now <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-xl hover:bg-gray-50 transition-colors"
            >
              View on {job.source_ats} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-700">{value}</p>
      </div>
    </div>
  )
}

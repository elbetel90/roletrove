import Link from 'next/link'
import { MapPin, Clock, DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, timeAgo, formatSalary, ATS_COLORS, SENIORITY_COLORS, LOCATION_ICONS } from '@/lib/utils'
import type { JobDocument } from '@roletrove/search'

interface JobCardProps {
  job: JobDocument
  compact?: boolean
}

export function JobCard({ job, compact = false }: JobCardProps) {
  const salary = formatSalary(job.comp_min ?? null, job.comp_max ?? null, job.comp_currency ?? null)
  const locIcon = LOCATION_ICONS[job.location_type] ?? '📍'

  return (
    <Link href={`/jobs/${job.id}`} className="block group">
      <div className={cn(
        'bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-md transition-all duration-150',
        compact && 'p-3',
      )}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={cn(
              'font-semibold text-gray-900 group-hover:text-brand-600 truncate transition-colors',
              compact ? 'text-sm' : 'text-base',
            )}>
              {job.title}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5 truncate">{job.company_name}</p>
          </div>

          {/* ATS badge */}
          <Badge className={cn('shrink-0 capitalize', ATS_COLORS[job.source_ats] ?? ATS_COLORS.unknown)}>
            {job.source_ats}
          </Badge>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {/* Seniority */}
          {job.seniority && job.seniority !== 'unknown' && (
            <Badge className={SENIORITY_COLORS[job.seniority] ?? ''}>
              {job.seniority}
            </Badge>
          )}

          {/* Location */}
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <span>{locIcon}</span>
            <span className="capitalize">{job.location_type}</span>
            {job.location_country && (
              <span className="text-gray-400">· {job.location_country}</span>
            )}
          </span>

          {/* Salary */}
          {salary && (
            <span className="flex items-center gap-0.5 text-xs text-emerald-700 font-medium">
              <DollarSign className="h-3 w-3" />
              {salary}
            </span>
          )}

          {/* Equity */}
          {job.has_equity && (
            <span className="text-xs text-purple-600 font-medium">+ equity</span>
          )}
        </div>

        {/* Tech chips (top 5) */}
        {!compact && job.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {job.tech_stack.slice(0, 5).map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs font-mono"
              >
                {tech}
              </span>
            ))}
            {job.tech_stack.length > 5 && (
              <span className="text-xs text-gray-400 self-center">
                +{job.tech_stack.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(job.first_seen_at)}
          </span>
          {job.department && (
            <span className="text-xs text-gray-400 truncate max-w-[140px]">
              {job.department}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

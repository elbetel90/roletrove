import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SearchBar } from '@/components/jobs/search-bar'
import { FilterPanel } from '@/components/jobs/filter-panel'
import { JobCard } from '@/components/jobs/job-card'
import { Pagination } from '@/components/ui/pagination'
import { Spinner } from '@/components/ui/spinner'
import { SortTabs } from '@/components/jobs/sort-tabs'
import { searchJobs } from '@roletrove/search'
import type { JobSearchParams } from '@roletrove/search'

export const metadata: Metadata = { title: 'Browse Jobs' }

interface PageProps {
  searchParams: {
    q?: string
    seniority?: string
    role_family?: string
    location_type?: string
    location_country?: string
    tech_stack?: string
    company_slug?: string
    source_ats?: string
    sort?: string
    page?: string
  }
}

export default async function JobsPage({ searchParams: sp }: PageProps) {
  const page  = Math.max(parseInt(sp.page ?? '1', 10), 1)
  const limit = 24

  const params: JobSearchParams = {
    q:             sp.q,
    seniority:     sp.seniority,
    role_family:   sp.role_family,
    location_type: sp.location_type,
    tech_stack:    sp.tech_stack,
    company_slug:  sp.company_slug,
    source_ats:    sp.source_ats,
    sort:          (sp.sort as JobSearchParams['sort']) ?? 'newest',
    page,
    limit,
  }

  const result = await searchJobs(params).catch(() => null)

  const facets = result?.facets ?? {
    seniority:        [],
    role_family:      [],
    location_type:    [],
    location_country: [],
    tech_stack:       [],
    source_ats:       [],
    company_name:     [],
    employment_type:  [],
  }

  return (
    <div>
      {/* Page header + search */}
      <div className="mb-6 space-y-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Browse Jobs</h1>
          {result && (
            <p className="text-sm text-gray-500">
              {result.found.toLocaleString()} results
              {result.search_time_ms > 0 && (
                <span className="text-gray-300 ml-1">· {result.search_time_ms}ms</span>
              )}
            </p>
          )}
        </div>

        <Suspense fallback={<div className="h-11 bg-gray-100 rounded-xl animate-pulse" />}>
          <SearchBar placeholder="Search by title, tech, company…" className="max-w-2xl" />
        </Suspense>

        <Suspense>
          <SortTabs current={sp.sort ?? 'newest'} />
        </Suspense>
      </div>

      <div className="flex gap-6">
        {/* Filter sidebar */}
        <div className="hidden lg:block w-56 shrink-0">
          <Suspense>
            <FilterPanel facets={facets} />
          </Suspense>
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {!result ? (
            <div className="flex items-center justify-center py-24">
              <Spinner />
            </div>
          ) : result.hits.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <p className="text-lg font-medium text-gray-600 mb-1">No jobs found</p>
              <p className="text-sm">Try adjusting your search or removing some filters.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {result.hits.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
              <Suspense>
                <Pagination page={page} totalPages={result.total_pages} />
              </Suspense>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { searchJobs } from '@roletrove/search'
import type { JobSearchParams } from '@roletrove/search'
import { withApiKey, ApiError } from '@/lib/api-auth'

export const runtime = 'nodejs'

/**
 * GET /api/v1/jobs
 *
 * Public B2B API — identical to /api/jobs but requires an API key.
 * Returns the canonical JobRecord schema documented in @roletrove/shared.
 *
 * Authentication: Authorization: Bearer <api_key>
 */
export const GET = withApiKey(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams

  const params: JobSearchParams = {
    q:             sp.get('q') ?? undefined,
    seniority:     sp.get('seniority') ?? undefined,
    role_family:   sp.get('role_family') ?? undefined,
    location_type: sp.get('location_type') ?? undefined,
    tech_stack:    sp.get('tech_stack') ?? undefined,
    company_slug:  sp.get('company_slug') ?? undefined,
    source_ats:    sp.get('source_ats') ?? undefined,
    status:        sp.get('status') ?? undefined,
    has_comp:      sp.get('has_comp') === 'true' ? true : undefined,
    sort:          (sp.get('sort') as JobSearchParams['sort']) ?? 'newest',
    page:          sp.get('page') ? parseInt(sp.get('page')!, 10) : 1,
    limit:         sp.get('limit') ? parseInt(sp.get('limit')!, 10) : 20,
  }

  if (params.limit! > 100) {
    return ApiError.badRequest('limit must not exceed 100')
  }

  try {
    const result = await searchJobs(params)

    return NextResponse.json(
      {
        object: 'list',
        data:   result.hits,
        found:  result.found,
        page:   result.page,
        total_pages: result.total_pages,
        facets: result.facets,
        search_time_ms: result.search_time_ms,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=10',
          'X-Search-Time-Ms': String(result.search_time_ms),
        },
      },
    )
  } catch (err: any) {
    console.error('[/api/v1/jobs] Search error:', err?.message)
    return ApiError.internal('Search unavailable')
  }
})

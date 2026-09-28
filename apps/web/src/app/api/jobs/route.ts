import { NextRequest, NextResponse } from 'next/server'
import { searchJobs } from '@roletrove/search'
import type { JobSearchParams } from '@roletrove/search'
import { ApiError } from '@/lib/api-auth'

export const runtime = 'nodejs'

/**
 * GET /api/jobs
 *
 * Search jobs via Typesense (sub-10ms). Returns hits + facet counts.
 *
 * Query params:
 *   q             - free text (default: match all)
 *   seniority     - comma-sep: intern,junior,mid,senior,staff,unknown
 *   role_family   - comma-sep: software_engineer,frontend,backend,...
 *   location_type - comma-sep: remote,hybrid,onsite,unknown
 *   tech_stack    - comma-sep: react,typescript,...
 *   company_slug  - exact company slug
 *   source_ats    - greenhouse|ashby|lever|workable|...
 *   status        - comma-sep (default: active,updated)
 *   has_comp      - true|false — only jobs with salary info
 *   sort          - newest|oldest|updated (default: newest)
 *   page          - 1-indexed (default: 1)
 *   limit         - per page (default: 20, max 100)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
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

  if (params.page && (isNaN(params.page) || params.page < 1)) {
    return ApiError.badRequest('Invalid page parameter')
  }
  if (params.limit && (isNaN(params.limit) || params.limit < 1 || params.limit > 100)) {
    return ApiError.badRequest('limit must be between 1 and 100')
  }

  try {
    const result = await searchJobs(params)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        'X-Search-Time-Ms': String(result.search_time_ms),
      },
    })
  } catch (err: any) {
    // Typesense down — don't crash the API
    console.error('[/api/jobs] Typesense error:', err?.message)
    return ApiError.internal('Search unavailable')
  }
}

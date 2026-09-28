import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@roletrove/db'
import { withApiKey, ApiError } from '@/lib/api-auth'

export const runtime = 'nodejs'

/**
 * GET /api/v1/companies
 *
 * Returns tracked companies with open role counts.
 * Authentication: Authorization: Bearer <api_key>
 *
 * Query params:
 *   ats_type - filter by ATS
 *   limit    - max results (default: 200, max: 500)
 */
export const GET = withApiKey(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams
  const atsType = sp.get('ats_type') ?? undefined
  const limit   = Math.min(parseInt(sp.get('limit') ?? '200', 10), 500)

  if (isNaN(limit) || limit < 1) {
    return ApiError.badRequest('Invalid limit parameter')
  }

  const companies = await prisma.company.findMany({
    where: {
      status: 'active',
      ...(atsType ? { ats_type: atsType as any } : {}),
    },
    orderBy: { name: 'asc' },
    take: limit,
    select: {
      id: true, slug: true, name: true, domain: true, ats_type: true,
      next_poll_at: true, status: true, created_at: true,
      _count: {
        select: {
          jobs: { where: { status: { in: ['active', 'updated'] } } },
        },
      },
    },
  })

  const data = companies.map((c) => ({
    ...c,
    open_job_count: c._count.jobs,
    _count: undefined,
  }))

  return NextResponse.json({
    object: 'list',
    data,
    total: data.length,
  })
})

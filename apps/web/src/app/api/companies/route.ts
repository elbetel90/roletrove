import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@roletrove/db'

export const runtime = 'nodejs'

/**
 * GET /api/companies
 *
 * Returns all tracked companies with their open job counts.
 *
 * Query params:
 *   ats_type - filter by ATS (greenhouse|ashby|lever|...)
 *   status   - company status filter (active|inactive|dead|blocked), default: active
 *   limit    - max results (default: 200, max: 500)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const sp = req.nextUrl.searchParams
  const atsType  = sp.get('ats_type') ?? undefined
  const status   = sp.get('status') ?? 'active'
  const limit    = Math.min(parseInt(sp.get('limit') ?? '200', 10), 500)

  const companies = await prisma.company.findMany({
    where: {
      ...(status !== 'all' ? { status: status as any } : {}),
      ...(atsType ? { ats_type: atsType as any } : {}),
    },
    orderBy: { name: 'asc' },
    take: limit,
    select: {
      id:                  true,
      slug:                true,
      name:                true,
      domain:              true,
      ats_type:            true,
      poll_interval_hours: true,
      next_poll_at:        true,
      status:              true,
      created_at:          true,
      _count: {
        select: {
          jobs: {
            where: { status: { in: ['active', 'updated'] } },
          },
        },
      },
    },
  })

  const data = companies.map((c) => ({
    ...c,
    open_job_count: c._count.jobs,
    _count: undefined,
  }))

  return NextResponse.json(
    { data, total: data.length },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}

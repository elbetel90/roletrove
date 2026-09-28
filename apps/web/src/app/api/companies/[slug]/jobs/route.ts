import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@roletrove/db'
import { ApiError } from '@/lib/api-auth'

export const runtime = 'nodejs'

/**
 * GET /api/companies/:slug/jobs
 *
 * Returns paginated jobs for a specific company, from Postgres.
 *
 * Query params:
 *   status  - job status (default: active,updated)
 *   page    - 1-indexed (default: 1)
 *   limit   - per page (default: 50, max: 200)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
): Promise<NextResponse> {
  const { slug } = params
  const sp = req.nextUrl.searchParams
  const page  = Math.max(parseInt(sp.get('page') ?? '1', 10), 1)
  const limit = Math.min(parseInt(sp.get('limit') ?? '50', 10), 200)
  const statusRaw = sp.get('status') ?? 'active,updated'
  const statuses = statusRaw.split(',').map((s) => s.trim()).filter(Boolean)

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, ats_type: true, domain: true },
  })

  if (!company) return ApiError.notFound('Company not found')

  const [jobs, total] = await prisma.$transaction([
    prisma.job.findMany({
      where: { company_id: company.id, status: { in: statuses as any[] } },
      orderBy: { first_seen_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, title: true, title_normalized: true,
        seniority: true, role_family: true,
        location_type: true, location_country: true, location_raw: true,
        employment_type: true, department: true, team: true,
        tech_stack: true, tags: true,
        comp_min: true, comp_max: true, comp_currency: true, has_equity: true,
        apply_url: true, source_url: true, source_ats: true,
        status: true, first_seen_at: true, last_seen_at: true,
      },
    }),
    prisma.job.count({
      where: { company_id: company.id, status: { in: statuses as any[] } },
    }),
  ])

  return NextResponse.json({
    company,
    data: jobs,
    total,
    page,
    total_pages: Math.ceil(total / limit),
  })
}

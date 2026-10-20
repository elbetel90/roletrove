import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@roletrove/db'
import { requireSession } from '@/lib/require-session'

export const runtime = 'nodejs'

/**
 * GET /api/crawl-logs
 *
 * Returns the most recent crawl log per company (or globally).
 *
 * Query params:
 *   company_slug - filter to a single company
 *   limit        - max entries (default: 100, max: 500)
 *   errors_only  - true|false — only return entries with errors
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { error } = await requireSession()
  if (error) return error

  const sp = req.nextUrl.searchParams
  const companySlug = sp.get('company_slug') ?? undefined
  const errorsOnly  = sp.get('errors_only') === 'true'
  const limit       = Math.min(parseInt(sp.get('limit') ?? '100', 10), 500)

  // Look up company if slug provided
  let companyId: string | undefined
  if (companySlug) {
    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
      select: { id: true },
    })
    companyId = company?.id
  }

  const logs = await prisma.crawlLog.findMany({
    where: {
      ...(companyId ? { company_id: companyId } : {}),
      ...(errorsOnly ? { error: { not: null } } : {}),
    },
    orderBy: { started_at: 'desc' },
    take: limit,
    include: {
      company: {
        select: { slug: true, name: true, ats_type: true },
      },
    },
  })

  // Compute summary per company (last crawl status at a glance)
  const summary = await prisma.crawlLog.groupBy({
    by: ['company_id'],
    _max: { started_at: true },
    _sum: { jobs_new: true, jobs_updated: true, jobs_closed: true },
    ...(companyId ? { where: { company_id: companyId } } : {}),
    orderBy: { company_id: 'asc' },
    take: 200,
  })

  return NextResponse.json({
    data: logs,
    summary_count: summary.length,
    total: logs.length,
  })
}

import { NextResponse } from 'next/server'
import { prisma } from '@roletrove/db'

export const runtime = 'nodejs'

/**
 * GET /api/stats
 *
 * Aggregate stats for the dashboard. All queries run against Postgres.
 * Heavy queries are cached at the CDN/ISR level (30 min stale-while-revalidate).
 */
export async function GET(): Promise<NextResponse> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalActive,
    newThisWeek,
    totalCompanies,
    byAts,
    bySeniority,
    byLocationTpe,
    topTechStack,
    closedThisWeek,
  ] = await Promise.all([
    // Total active/updated jobs
    prisma.job.count({ where: { status: { in: ['active', 'updated'] } } }),

    // New jobs ingested in last 7 days
    prisma.job.count({
      where: {
        status: { in: ['active', 'updated'] },
        first_seen_at: { gte: sevenDaysAgo },
      },
    }),

    // Total tracked companies (active)
    prisma.company.count({ where: { status: 'active' } }),

    // Jobs by ATS
    prisma.job.groupBy({
      by: ['source_ats'],
      where: { status: { in: ['active', 'updated'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),

    // Jobs by seniority
    prisma.job.groupBy({
      by: ['seniority'],
      where: { status: { in: ['active', 'updated'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),

    // Jobs by location type
    prisma.job.groupBy({
      by: ['location_type'],
      where: { status: { in: ['active', 'updated'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),

    // Top 20 tech stack terms (unnest the tech_stack[] and count)
    prisma.$queryRaw<Array<{ term: string; count: bigint }>>`
      SELECT term, COUNT(*) as count
      FROM (
        SELECT unnest(tech_stack) as term
        FROM "Job"
        WHERE status IN ('active', 'updated')
      ) t
      GROUP BY term
      ORDER BY count DESC
      LIMIT 20
    `,

    // Closed this week
    prisma.job.count({
      where: {
        status: 'closed',
        closed_at: { gte: sevenDaysAgo },
      },
    }),
  ])

  return NextResponse.json(
    {
      total_active:    totalActive,
      new_this_week:   newThisWeek,
      closed_this_week: closedThisWeek,
      total_companies: totalCompanies,

      by_ats: byAts.map((r) => ({
        ats_type: r.source_ats,
        count:    r._count.id,
      })),

      by_seniority: bySeniority.map((r) => ({
        seniority: r.seniority ?? 'unknown',
        count:     r._count.id,
      })),

      by_location_type: byLocationTpe.map((r) => ({
        location_type: r.location_type,
        count:         r._count.id,
      })),

      top_tech_stack: topTechStack.map((r) => ({
        term:  r.term,
        count: Number(r.count),
      })),
    },
    {
      headers: {
        // Cache for 5 min at CDN; serve stale for 30 min
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
      },
    },
  )
}

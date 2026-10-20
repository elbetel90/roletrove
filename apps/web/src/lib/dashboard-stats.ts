import { prisma } from '@roletrove/db'

export async function getDashboardStats() {
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
    prisma.job.count({ where: { status: { in: ['active', 'updated'] } } }),
    prisma.job.count({
      where: {
        status: { in: ['active', 'updated'] },
        first_seen_at: { gte: sevenDaysAgo },
      },
    }),
    prisma.company.count({ where: { status: 'active' } }),
    prisma.job.groupBy({
      by: ['source_ats'],
      where: { status: { in: ['active', 'updated'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.job.groupBy({
      by: ['seniority'],
      where: { status: { in: ['active', 'updated'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.job.groupBy({
      by: ['location_type'],
      where: { status: { in: ['active', 'updated'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
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
    prisma.job.count({
      where: {
        status: 'closed',
        closed_at: { gte: sevenDaysAgo },
      },
    }),
  ])

  return {
    total_active: totalActive,
    new_this_week: newThisWeek,
    closed_this_week: closedThisWeek,
    total_companies: totalCompanies,
    by_ats: byAts.map((r) => ({
      ats_type: r.source_ats,
      count: r._count.id,
    })),
    by_seniority: bySeniority.map((r) => ({
      seniority: r.seniority ?? 'unknown',
      count: r._count.id,
    })),
    by_location_type: byLocationTpe.map((r) => ({
      location_type: r.location_type,
      count: r._count.id,
    })),
    top_tech_stack: topTechStack.map((r) => ({
      term: r.term,
      count: Number(r.count),
    })),
  }
}

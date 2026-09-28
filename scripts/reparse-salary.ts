/**
 * Re-parse compensation for all jobs where comp_min/comp_max are NULL
 * but description_text contains salary hints.
 * Run: pnpm exec tsx scripts/reparse-salary.ts
 */
import { prisma } from '@roletrove/db'
import { parseCompensation } from '@roletrove/ats-adapters'

const BATCH = 500

async function main() {
  let cursor: string | undefined
  let total = 0
  let updated = 0

  console.log('Re-parsing compensation for jobs with null salary...')

  while (true) {
    const jobs = await prisma.job.findMany({
      where: {
        // Re-parse jobs missing any salary component
        OR: [
          { comp_min: null, comp_max: null },
          { comp_min: { not: null }, comp_max: null },
        ],
        description_text: { not: '' },
        status: { in: ['active', 'updated'] },
      },
      select: { id: true, description_text: true },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })

    if (jobs.length === 0) break
    cursor = jobs[jobs.length - 1].id
    total += jobs.length

    const updates = jobs
      .map((j) => ({ id: j.id, ...parseCompensation(j.description_text) }))
      .filter((u) => u.comp_min !== null || u.comp_max !== null)

    for (const u of updates) {
      await prisma.job.update({
        where: { id: u.id },
        data: { comp_min: u.comp_min, comp_max: u.comp_max, comp_currency: u.comp_currency },
      })
    }

    updated += updates.length
    process.stdout.write(`\r  Scanned ${total}, updated ${updated}`)
  }

  console.log(`\nDone. Scanned ${total} jobs, updated salary on ${updated}.`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })

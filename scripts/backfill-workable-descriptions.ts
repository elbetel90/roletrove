/**
 * Backfill description_text + tech_stack for Workable jobs that were ingested
 * before Phase 7 (description enrichment) and have empty description_text.
 *
 * Usage:
 *   node --env-file=.env --import=tsx/esm scripts/backfill-workable-descriptions.ts
 *   # or via pnpm script (see root package.json):
 *   pnpm backfill:workable
 *
 * Rate limit: Workable allows ~30 rpm. This script fetches 1 detail per 2.1 s.
 * Estimated time: ~6 min per 100 jobs with empty descriptions.
 */

import { prisma } from '@roletrove/db'
import { fetchWorkableJobDetail } from '@roletrove/ats-adapters'
import { extractTechStack } from '@roletrove/shared'
import { indexJob, buildJobDocument } from '@roletrove/search'

const DELAY_MS = 2_100 // 2.1 s ≈ 28 rpm — safely under 30 rpm

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { ats_type: 'workable', status: { in: ['active', 'inactive'] } },
    select: { id: true, slug: true, name: true, ats_token: true },
    orderBy: { slug: 'asc' },
  })

  console.log(`Found ${companies.length} Workable companies\n`)

  let totalJobs    = 0
  let totalUpdated = 0
  let totalErrors  = 0

  for (const company of companies) {
    const jobs = await prisma.job.findMany({
      where: {
        company_id: company.id,
        source_ats: 'workable',
        status:     { in: ['active', 'updated'] },
        OR: [{ description_text: null }, { description_text: '' }],
      },
      select: { id: true, source_id: true },
      orderBy: { first_seen_at: 'asc' },
    })

    if (jobs.length === 0) continue

    totalJobs += jobs.length
    console.log(`${company.slug}: ${jobs.length} jobs to backfill`)

    for (const job of jobs) {
      try {
        const detail = await fetchWorkableJobDetail(company.ats_token, job.source_id)

        if (!detail) {
          process.stdout.write('·')
          await sleep(DELAY_MS)
          continue
        }

        // Combine available description sections
        const descParts = [
          detail.full_description,
          detail.description,
          detail.requirements,
          detail.benefits,
        ].filter((s): s is string => Boolean(s))

        const description_html = descParts.join('\n')
        const description_text = description_html
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        if (!description_text) {
          process.stdout.write('·')
          await sleep(DELAY_MS)
          continue
        }

        const tech_stack = extractTechStack(description_text)

        // Persist to Postgres
        const updated = await prisma.job.update({
          where: { id: job.id },
          data: { description_text, description_html, tech_stack },
          include: { company: { select: { slug: true, name: true } } },
        })

        // Re-index in Typesense
        const doc = buildJobDocument(updated, updated.company)
        await indexJob(doc)

        totalUpdated++
        process.stdout.write('+')
      } catch {
        totalErrors++
        process.stdout.write('E')
      }

      await sleep(DELAY_MS)
    }

    process.stdout.write('\n')
  }

  console.log(
    `\n✓ Done — scanned ${totalJobs} jobs, updated ${totalUpdated}, errors ${totalErrors}`,
  )

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('✗ Backfill failed:', err?.message ?? err)
  process.exit(1)
})

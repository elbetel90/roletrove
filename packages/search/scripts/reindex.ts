/**
 * Full reindex: read all active/updated jobs from Postgres and bulk-import
 * them into Typesense. Run this after:
 *   - Creating the collection for the first time
 *   - A schema migration that requires a full reindex
 *   - Recovering from data loss in Typesense
 *
 * Usage:
 *   pnpm --filter @roletrove/search exec tsx scripts/reindex.ts
 *
 * Environment:
 *   DATABASE_URL — Postgres connection string
 *   TYPESENSE_*  — Typesense connection config
 */

import { prisma } from '@roletrove/db'
import { ensureCollection, bulkIndexJobs, buildJobDocument } from '../src/index'
const BATCH_SIZE = 500

async function main(): Promise<void> {
  await ensureCollection()

  const total = await prisma.job.count({
    where: { status: { in: ['active', 'updated'] } },
  })

  console.log(`Reindexing ${total} active/updated jobs...`)

  let cursor: string | undefined
  let indexed = 0
  let errors  = 0

  while (true) {
    const jobs = await prisma.job.findMany({
      where: { status: { in: ['active', 'updated'] } },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { company: { select: { slug: true, name: true } } },
    })

    if (jobs.length === 0) break

    const docs = jobs.map((job: any) =>
      buildJobDocument(job, job.company),
    )

    const result = await bulkIndexJobs(docs)
    indexed += result.success
    errors  += result.errors

    if (result.errors > 0) {
      console.error(`  Batch errors (${result.errors}):`, result.error_details.slice(0, 5))
    }

    cursor = jobs[jobs.length - 1].id
    const pct = ((indexed / total) * 100).toFixed(1)
    process.stdout.write(`\r  ${indexed}/${total} (${pct}%) indexed, ${errors} errors`)
  }

  console.log(`\n\n✓ Reindex complete: ${indexed} indexed, ${errors} errors`)
}

main()
  .catch((err) => {
    console.error('\n✗ Reindex failed:', err?.message ?? err)
    process.exit(1)
  })

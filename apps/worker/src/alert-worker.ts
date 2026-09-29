/**
 * Alert worker — matches newly indexed jobs against saved searches and sends
 * email digests via Resend.
 *
 * Run via the scheduler: daily at 08:00 UTC.
 *
 * Strategy:
 *   1. Load all SavedSearches with notify_email: true + their users.
 *   2. For each search, search Typesense using stored filters + a
 *      first_seen_after_ms window (last 25 h for daily, last 65 min for instant).
 *   3. Create JobAlert rows for each match (skipDuplicates guards against re-alert).
 *   4. For any newly created alerts, send one email digest per search.
 *   5. Stamp notified_at on the sent alerts.
 */

import { prisma } from '@roletrove/db'
import { searchJobs } from '@roletrove/search'
import type { JobSearchParams } from '@roletrove/search'
import { sendJobAlertDigest } from './email'
import { logger } from './logger'

// ─── Types ────────────────────────────────────────────────────────────────────

type FrequencyWindow = 'daily' | 'instant'

const WINDOW_MS: Record<FrequencyWindow, number> = {
  daily:   25 * 60 * 60 * 1000,   // 25 h (slightly more than 24 h for overlap safety)
  instant:  65 * 60 * 1000,       // 65 min (hourly cron with buffer)
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run one alert check pass. Called by the scheduler.
 * @param frequency - which frequency bucket to process ('daily' | 'instant')
 */
export async function runAlertCheck(frequency: FrequencyWindow = 'daily'): Promise<void> {
  const searches = await prisma.savedSearch.findMany({
    where: {
      notify_email:     true,
      notify_frequency: frequency,
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  })

  if (searches.length === 0) return

  logger.info({ count: searches.length, frequency }, 'Alert check: processing saved searches')

  for (const search of searches) {
    try {
      await processSearch(search, frequency)
    } catch (err) {
      logger.error(
        { saved_search_id: search.id, user: search.user.email, err: String(err) },
        'Alert check: error processing search',
      )
    }
  }
}

// ─── Per-search processing ────────────────────────────────────────────────────

async function processSearch(
  search: Awaited<ReturnType<typeof prisma.savedSearch.findMany>>[number] & {
    user: { id: string; email: string }
  },
  frequency: FrequencyWindow,
): Promise<void> {
  const windowMs = WINDOW_MS[frequency]
  const since    = Date.now() - windowMs

  // Build search params from stored filters JSON
  const storedFilters = (search.filters ?? {}) as Partial<JobSearchParams>

  let result: Awaited<ReturnType<typeof searchJobs>>
  try {
    result = await searchJobs({
      ...storedFilters,
      status:              'active,updated',
      sort:                'newest',
      limit:               100,
      first_seen_after_ms: since,
    })
  } catch (err) {
    logger.warn(
      { saved_search_id: search.id, err: String(err) },
      'Alert check: Typesense search failed — skipping search',
    )
    return
  }

  if (result.hits.length === 0) return

  const candidateJobIds = result.hits.map((h) => h.id)

  // Find which of these job IDs already have an alert for this search
  const existing = await prisma.jobAlert.findMany({
    where: { saved_search_id: search.id, job_id: { in: candidateJobIds } },
    select: { job_id: true },
  })
  const alreadyAlerted = new Set(existing.map((a) => a.job_id))

  const newJobIds = candidateJobIds.filter((id) => !alreadyAlerted.has(id))
  if (newJobIds.length === 0) return

  // Persist new JobAlert rows
  await prisma.jobAlert.createMany({
    data: newJobIds.map((job_id) => ({
      job_id,
      saved_search_id: search.id,
    })),
    skipDuplicates: true,
  })

  // Build the digest payload
  const newHits = result.hits.filter((h) => newJobIds.includes(h.id))
  const jobsForEmail = newHits.map((h) => ({
    title:     h.title,
    company:   h.company_name,
    url:       h.apply_url,
    seniority: h.seniority,
  }))

  // Send email
  await sendJobAlertDigest(search.user.email, search.name, jobsForEmail)

  // Stamp notified_at
  await prisma.jobAlert.updateMany({
    where: { saved_search_id: search.id, job_id: { in: newJobIds } },
    data:  { notified_at: new Date() },
  })

  logger.info(
    {
      saved_search_id: search.id,
      user:            search.user.email,
      search_name:     search.name,
      new_jobs:        newJobIds.length,
    },
    'Alert check: digest sent',
  )
}

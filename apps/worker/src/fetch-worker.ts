import { Worker } from 'bullmq'
import { prisma } from '@roletrove/db'
import {
  fetchGreenhouseJobs,
  fetchAshbyJobs,
  fetchLeverJobs,
  fetchWorkableJobs,
  fetchSmartRecruitersJobs,
  AtsHttpError,
} from '@roletrove/ats-adapters'
import { bullConnection } from './redis'
import { jobNormalizeQueue, QUEUE_COMPANY_POLL } from './queues'
import type { PollJobData } from './queues'
import { RateLimiter, ATS_DOMAINS } from './rate-limiter'
import { closeMissingJobs } from './state-machine'
import { logger } from './logger'
import {
  crawlJobsTotal,
  crawlDuration,
  crawlErrorsTotal,
  queueProcessed,
} from './metrics'

// ─── Source-ID extractor ──────────────────────────────────────────────────────
// Extracts the stable ATS-native identifier from each raw job object.

function extractSourceIds(rawJobs: unknown[], atsType: string): string[] {
  return rawJobs.map((j: any) => {
    switch (atsType) {
      case 'greenhouse':      return String(j.id)
      case 'ashby':           return String(j.id)
      case 'lever':           return String(j.id)
      case 'workable':        return String(j.id ?? j.shortcode)
      case 'smartrecruiters': return String(j.id)
      default:                return String((j as any).id)
    }
  })
}

// ─── Fetch worker ─────────────────────────────────────────────────────────────

// How long BullMQ holds the job lock before considering it stalled.
// Large SR companies can have 500+ jobs at 1 req/s → many minutes of work.
// We extend the lock proactively every LOCK_RENEW_MS so it never expires.
const LOCK_DURATION_MS = 60_000       // 1-minute lock window
const LOCK_RENEW_MS    = 20_000       // renew every 20 s (well before expiry)

export function createFetchWorker(rateLimiter: RateLimiter): Worker<PollJobData> {
  const worker = new Worker<PollJobData>(
    QUEUE_COMPANY_POLL,
    async (job) => {
      const {
        company_id,
        company_slug,
        ats_type,
        ats_token,
        poll_interval_hours,
      } = job.data

      // Keep the lock alive for long-running fetches (e.g. SR with 500+ roles)
      const lockExtender = setInterval(() => {
        job.extendLock(LOCK_DURATION_MS).catch(() => {})
      }, LOCK_RENEW_MS)

      const startedAt = new Date()
      const timerEnd = crawlDuration.startTimer({ ats_type, company_slug })

      const crawlLog = await prisma.crawlLog.create({
        data: {
          company_id,
          ats_type: ats_type as any,
          started_at: startedAt,
        },
        select: { id: true },
      })

      logger.info({ company_slug, ats_type }, 'Polling company')

      // ── Rate limiting ────────────────────────────────────────────────────────
      const domain = ATS_DOMAINS[ats_type] ?? ats_type
      await rateLimiter.consume(domain)

      // ── Fetch raw jobs from ATS ─────────────────────────────────────────────
      let rawJobs: unknown[] = []

      try {
        switch (ats_type) {
          case 'greenhouse':
            rawJobs = await fetchGreenhouseJobs(ats_token)
            break
          case 'ashby':
            rawJobs = await fetchAshbyJobs(ats_token)
            break
          case 'lever':
            rawJobs = await fetchLeverJobs(ats_token)
            break
          case 'workable':
            rawJobs = await fetchWorkableJobs(ats_token)
            break
          case 'smartrecruiters':
            rawJobs = await fetchSmartRecruitersJobs(ats_token)
            break
          default:
            logger.warn({ ats_type }, 'Unknown ATS type — skipping fetch')
        }
      } catch (err) {
        clearInterval(lockExtender)

        const errType =
          err instanceof AtsHttpError
            ? `http_${err.status}`
            : 'network'

        crawlErrorsTotal.inc({ ats_type, error_type: errType })

        const errMsg = err instanceof Error ? err.message : String(err)
        logger.error({ company_slug, ats_type, err: errMsg }, 'ATS fetch failed')

        timerEnd()

        await finalizeCrawl({
          crawl_log_id: crawlLog.id,
          company_id,
          poll_interval_hours,
          startedAt,
          jobs_found: 0,
          jobs_new: 0,
          jobs_updated: 0,
          jobs_closed: 0,
          error: errMsg,
        })

        // Re-throw so BullMQ retries the job with backoff
        throw err
      }

      crawlJobsTotal.inc({ ats_type }, rawJobs.length)
      logger.info({ company_slug, ats_type, count: rawJobs.length }, 'Fetched raw jobs')

      // ── Close missing jobs (before fanning out so DB is consistent) ──────────
      const currentSourceIds = extractSourceIds(rawJobs, ats_type)
      const jobsClosed = await closeMissingJobs(
        company_id,
        currentSourceIds,
        poll_interval_hours,
      )

      // ── Fan out to job-normalize queue ────────────────────────────────────────
      if (rawJobs.length > 0) {
        // Bulk-add in chunks of 500 to avoid Redis pipeline limits
        const CHUNK = 500
        for (let i = 0; i < rawJobs.length; i += CHUNK) {
          const chunk = rawJobs.slice(i, i + CHUNK)
          await jobNormalizeQueue.addBulk(
            chunk.map((raw_job, idx) => ({
              name: `${company_slug}:${i + idx}`,
              data: { company_id, company_slug, ats_type, raw_job },
            })),
          )
        }
      }

      clearInterval(lockExtender)
      timerEnd()
      queueProcessed.inc({ queue_name: QUEUE_COMPANY_POLL, status: 'completed' })

      await finalizeCrawl({
        crawl_log_id: crawlLog.id,
        company_id,
        poll_interval_hours,
        startedAt,
        jobs_found: rawJobs.length,
        jobs_new: 0,   // tallied by normalize workers
        jobs_updated: 0,
        jobs_closed: jobsClosed,
        error: null,
      })

      logger.info(
        { company_slug, ats_type, jobs_found: rawJobs.length, jobs_closed: jobsClosed },
        'Poll complete',
      )
    },
    {
      connection: bullConnection,
      concurrency: 5,
      lockDuration: LOCK_DURATION_MS,
    },
  )

  worker.on('failed', (job, err) => {
    queueProcessed.inc({ queue_name: QUEUE_COMPANY_POLL, status: 'failed' })
    logger.error(
      { company_slug: job?.data.company_slug, err: err.message, attempts: job?.attemptsMade },
      'Fetch worker job failed',
    )
  })

  return worker
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function finalizeCrawl(params: {
  crawl_log_id: string
  company_id: string
  poll_interval_hours: number
  startedAt: Date
  jobs_found: number
  jobs_new: number
  jobs_updated: number
  jobs_closed: number
  error: string | null
}): Promise<void> {
  const completedAt = new Date()
  const durationMs = completedAt.getTime() - params.startedAt.getTime()

  // Update crawl log
  await prisma.crawlLog.update({
    where: { id: params.crawl_log_id },
    data: {
      completed_at: completedAt,
      duration_ms:  durationMs,
      jobs_found:   params.jobs_found,
      jobs_new:     params.jobs_new,
      jobs_updated: params.jobs_updated,
      jobs_closed:  params.jobs_closed,
      error:        params.error,
    },
  })

  // Schedule next poll
  const nextPollAt = new Date(
    Date.now() + params.poll_interval_hours * 60 * 60 * 1000,
  )

  await prisma.company.update({
    where: { id: params.company_id },
    data: {
      next_poll_at: nextPollAt,
      // Mark as dead if persistent fetch errors accumulate (handled by scheduler)
    },
  })
}

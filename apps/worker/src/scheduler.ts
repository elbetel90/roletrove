import cron from 'node-cron'
import { prisma } from '@roletrove/db'
import { enqueueCompanyPoll, companyPollQueue } from './queues'
import { archiveOldClosedJobs } from './state-machine'
import { runAlertCheck } from './alert-worker'
import { queueDepth } from './metrics'
import { logger } from './logger'

// ─── Scheduler ────────────────────────────────────────────────────────────────

let pollTask: cron.ScheduledTask | null = null
let archiveTask: cron.ScheduledTask | null = null
let alertDailyTask: cron.ScheduledTask | null = null
let alertInstantTask: cron.ScheduledTask | null = null

/**
 * Start the scheduler.
 *
 * - Every minute: query companies with next_poll_at <= NOW() and enqueue them.
 *   BullMQ job ID deduplication ensures no company is double-enqueued.
 *
 * - Daily at 03:00 UTC: archive jobs closed more than 30 days ago.
 */
export function startScheduler(): void {
  // ── Every minute: poll due companies ────────────────────────────────────────
  pollTask = cron.schedule('* * * * *', async () => {
    try {
      await enqueueDueCompanies()
    } catch (err) {
      logger.error({ err }, 'Scheduler: error in poll task')
    }
  })

  // ── Daily at 03:00 UTC: archive old closed jobs ──────────────────────────────
  archiveTask = cron.schedule('0 3 * * *', async () => {
    try {
      const count = await archiveOldClosedJobs()
      logger.info({ archived: count }, 'Scheduler: daily archive sweep complete')
    } catch (err) {
      logger.error({ err }, 'Scheduler: error in archive task')
    }
  })

  // ── Daily at 08:00 UTC: send job alert digests (daily frequency) ─────────────
  alertDailyTask = cron.schedule('0 8 * * *', async () => {
    try {
      await runAlertCheck('daily')
    } catch (err) {
      logger.error({ err }, 'Scheduler: error in daily alert task')
    }
  })

  // ── Every hour: send instant job alerts ──────────────────────────────────────
  alertInstantTask = cron.schedule('0 * * * *', async () => {
    try {
      await runAlertCheck('instant')
    } catch (err) {
      logger.error({ err }, 'Scheduler: error in instant alert task')
    }
  })

  logger.info('Scheduler started (poll: every 1min, archive: daily 03:00 UTC, alerts: daily 08:00 UTC + hourly)')
}

export function stopScheduler(): void {
  pollTask?.stop()
  archiveTask?.stop()
  alertDailyTask?.stop()
  alertInstantTask?.stop()
  logger.info('Scheduler stopped')
}

// ─── Core: enqueue due companies ─────────────────────────────────────────────

async function enqueueDueCompanies(): Promise<void> {
  const due = await prisma.company.findMany({
    where: {
      next_poll_at: { lte: new Date() },
      status: { not: 'blocked' },
    },
    select: {
      id: true,
      slug: true,
      ats_type: true,
      ats_token: true,
      poll_interval_hours: true,
    },
    orderBy: { next_poll_at: 'asc' },
    take: 200, // cap per tick to avoid thundering herd on startup
  })

  if (due.length === 0) return

  logger.debug({ count: due.length }, 'Scheduler: enqueueing due companies')

  // Enqueue with stable job IDs (duplicates silently ignored by BullMQ)
  await Promise.all(
    due.map((company) =>
      enqueueCompanyPoll({
        company_id:          company.id,
        company_slug:        company.slug,
        ats_type:            company.ats_type as any,
        ats_token:           company.ats_token,
        poll_interval_hours: company.poll_interval_hours,
      }).catch((err) =>
        logger.error({ company_slug: company.slug, err }, 'Failed to enqueue company poll'),
      ),
    ),
  )

  // Update queue depth metric
  try {
    const waiting = await companyPollQueue.getWaitingCount()
    queueDepth.set({ queue_name: 'company-poll' }, waiting)
  } catch {
    // non-critical — ignore metric errors
  }
}

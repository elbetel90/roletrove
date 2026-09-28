import { Queue } from 'bullmq'
import { bullConnection } from './redis'
import type { AtsType } from '@roletrove/shared'

// ─── Job data types ───────────────────────────────────────────────────────────

export interface PollJobData {
  company_id: string
  company_slug: string
  ats_type: AtsType
  ats_token: string
  poll_interval_hours: number
}

export interface NormalizeJobData {
  company_id: string
  company_slug: string
  ats_type: AtsType
  /** Raw ATS job object (typed at call site per ATS) */
  raw_job: unknown
}

// ─── Queue names ──────────────────────────────────────────────────────────────

export const QUEUE_COMPANY_POLL = 'company-poll'
export const QUEUE_JOB_NORMALIZE = 'job-normalize'

// ─── Queue instances ──────────────────────────────────────────────────────────

export const companyPollQueue = new Queue<PollJobData>(QUEUE_COMPANY_POLL, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10_000, // 10s → 20s → 40s
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
})

export const jobNormalizeQueue = new Queue<NormalizeJobData>(QUEUE_JOB_NORMALIZE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5_000, // 5s → 10s → 20s → 40s → 80s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 2000 },
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Enqueue a company poll only if it isn't already waiting or active.
 * Uses BullMQ's job ID deduplication.
 */
export async function enqueueCompanyPoll(data: PollJobData): Promise<void> {
  // Stable job ID = company_slug so duplicates are silently ignored
  await companyPollQueue.add(data.company_slug, data, {
    jobId: `poll-${data.company_slug}`,
  })
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    companyPollQueue.close(),
    jobNormalizeQueue.close(),
  ])
}

import { Worker } from 'bullmq'
import { prisma } from '@roletrove/db'
import {
  normalizeGreenhouse,
  normalizeAshby,
  normalizeLever,
  normalizeSmartRecruiters,
  parseCompensation,
} from '@roletrove/ats-adapters'
import type {
  RawGreenhouseJob,
  RawAshbyJob,
  RawLeverJob,
  WorkableJobDetail,
  SmartRecruitersJobDetail,
} from '@roletrove/ats-adapters'
import type { JobRecord } from '@roletrove/shared'
import { indexJob, deleteJob, buildJobDocument } from '@roletrove/search'
import { bullConnection } from './redis'
import { QUEUE_JOB_NORMALIZE } from './queues'
import type { NormalizeJobData } from './queues'
import { upsertJob } from './state-machine'
import { logger } from './logger'
import { jobsIngested, crawlErrorsTotal, queueProcessed } from './metrics'

// ─── Workable normalizer (lightweight inline) ─────────────────────────────────
// Workable jobs have minimal description in the list endpoint, so we produce
// a reduced JobRecord. Full description requires a per-job detail fetch (Phase 7).

import {
  normalizeTitle,
  extractSeniority,
  extractRoleFamily,
  extractTechStack,
  parseLocation,
  toLocationBucket,
  computeHashes,
} from '@roletrove/shared'

function normalizeWorkable(
  raw: WorkableJobDetail,
  company_slug: string,
): JobRecord {
  const loc = raw.location
  const location_raw = loc.telecommuting
    ? `Remote - ${loc.location_str}`
    : loc.location_str

  // Combine available description fields (detail endpoint provides these)
  const descParts = [
    raw.full_description,
    raw.description,
    raw.requirements,
    raw.benefits,
  ].filter((s): s is string => Boolean(s))
  const description_html = descParts.join('\n')
  const description_text = description_html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const title_normalized = normalizeTitle(raw.title)
  const seniority = extractSeniority(raw.title)
  const role_family = extractRoleFamily(raw.title)
  const location = parseLocation(location_raw)
  const location_bucket = toLocationBucket(location)
  const hashes = computeHashes({
    company_slug,
    title_normalized,
    location_bucket,
    role_family,
    department: raw.department ?? null,
  })

  const tech_stack: string[] = description_text ? extractTechStack(description_text) : []
  const comp = description_text
    ? parseCompensation(description_text)
    : { comp_min: null, comp_max: null, comp_currency: null, has_equity: false }

  return {
    source_id:        raw.shortcode ?? raw.id,
    source_ats:       'workable',
    company_slug,
    title:            raw.full_title ?? raw.title,
    title_normalized,
    seniority,
    role_family,
    description_html,
    description_text,
    location,
    employment_type:  'unknown',
    department:       raw.department ?? null,
    team:             null,
    tech_stack,
    tags:             [],
    comp_min:         comp.comp_min,
    comp_max:         comp.comp_max,
    comp_currency:    comp.comp_currency,
    has_equity:       comp.has_equity,
    apply_url:        raw.application_url ?? '',
    source_url:       raw.url,
    source_created_at: raw.created_at ? new Date(raw.created_at) : null,
    source_updated_at: null,
    hashes,
  }
}

// ─── Main normalizer dispatcher ───────────────────────────────────────────────

function dispatchNormalize(data: NormalizeJobData): JobRecord {
  const { ats_type, company_slug, raw_job } = data

  switch (ats_type) {
    case 'greenhouse':
      return normalizeGreenhouse(raw_job as RawGreenhouseJob, company_slug)
    case 'ashby':
      return normalizeAshby(raw_job as RawAshbyJob, company_slug)
    case 'lever':
      return normalizeLever(raw_job as RawLeverJob, company_slug)
    case 'workable':
      return normalizeWorkable(raw_job as WorkableJobDetail, company_slug)
    case 'smartrecruiters':
      return normalizeSmartRecruiters(raw_job as SmartRecruitersJobDetail, company_slug)
    default:
      throw new Error(`Unsupported ATS type for normalization: ${ats_type}`)
  }
}

// ─── Normalize worker ─────────────────────────────────────────────────────────

export function createNormalizeWorker(): Worker<NormalizeJobData> {
  const worker = new Worker<NormalizeJobData>(
    QUEUE_JOB_NORMALIZE,
    async (job) => {
      const { company_id, company_slug, ats_type } = job.data

      let normalized: JobRecord

      try {
        normalized = dispatchNormalize(job.data)
      } catch (err) {
        crawlErrorsTotal.inc({ ats_type, error_type: 'normalize_error' })
        logger.error(
          { company_slug, ats_type, err: String(err) },
          'Normalization failed',
        )
        throw err
      }

      // Filter non-engineering roles (optional: only if role_family is useful)
      // For now we ingest everything and let the UI/API filter

      const result = await upsertJob(normalized, company_id)

      jobsIngested.inc({ ats_type, state: result.outcome })

      if (result.outcome !== 'unchanged') {
        logger.debug(
          {
            company_slug,
            ats_type,
            title: normalized.title,
            outcome: result.outcome,
            job_id: result.job_id,
          },
          'Job ingested',
        )
      }

      // ── Sync to Typesense (fire-and-forget, non-blocking) ───────────────────
      // Sequin CDC handles this in production; this is a direct write fallback.
      syncToTypesense(result.job_id, result.outcome, company_id).catch((err) =>
        logger.warn({ job_id: result.job_id, err: String(err) }, 'Typesense sync failed (non-fatal)'),
      )

      queueProcessed.inc({ queue_name: QUEUE_JOB_NORMALIZE, status: 'completed' })
    },
    {
      connection: bullConnection,
      concurrency: 20, // normalize is I/O bound (DB upsert), high concurrency is fine
    },
  )

  worker.on('failed', (job, err) => {
    queueProcessed.inc({ queue_name: QUEUE_JOB_NORMALIZE, status: 'failed' })
    logger.error(
      {
        company_slug: job?.data.company_slug,
        ats_type: job?.data.ats_type,
        err: err.message,
        attempts: job?.attemptsMade,
      },
      'Normalize worker job failed',
    )
  })

  return worker
}

// ─── Typesense sync helper ────────────────────────────────────────────────────

async function syncToTypesense(
  job_id: string,
  outcome: 'new' | 'updated' | 'unchanged',
  company_id: string,
): Promise<void> {
  if (outcome === 'unchanged') return // No content change — skip re-index

  const job = await prisma.job.findUnique({
    where: { id: job_id },
    include: { company: { select: { slug: true, name: true } } },
  })

  if (!job) return

  if (job.status === 'closed' || job.status === 'archived') {
    await deleteJob(job_id)
    return
  }

  const doc = buildJobDocument(job, job.company)
  await indexJob(doc)
}

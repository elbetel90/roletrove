import { prisma, Prisma } from '@roletrove/db'
import type { JobRecord } from '@roletrove/shared'
import { logger } from './logger'

// ─── Result types ─────────────────────────────────────────────────────────────

export type UpsertOutcome = 'new' | 'updated' | 'unchanged'

export interface UpsertResult {
  outcome: UpsertOutcome
  job_id: string
}

// ─── Upsert a single normalized job ──────────────────────────────────────────

/**
 * Insert or update a normalized JobRecord in Postgres using its exact_hash.
 *
 * State transitions:
 *   exact_hash not in DB               → INSERT, status=active
 *   exact_hash in DB, content unchanged → UPDATE last_seen_at only
 *   exact_hash in DB, content changed   → UPDATE status=updated, write JobSnapshot
 *
 * "Content change" is detected by comparing description_text (normalized text).
 */
export async function upsertJob(
  job: JobRecord,
  company_id: string,
): Promise<UpsertResult> {
  // 1. Look up existing row by exact_hash
  const existing = await prisma.job.findUnique({
    where: { exact_hash: job.hashes.exact_hash },
    select: {
      id: true,
      status: true,
      description_text: true,
      tech_stack: true,
      comp_min: true,
      comp_max: true,
    },
  })

  const now = new Date()

  if (!existing) {
    // ── New job ────────────────────────────────────────────────────────────────
    try {
      const created = await prisma.job.create({
        data: {
          source_id:        job.source_id,
          source_ats:       job.source_ats as any,
          company_id,

          title:             job.title,
          title_normalized:  job.title_normalized,
          seniority:         job.seniority,
          role_family:       job.role_family,

          description_text:  job.description_text,
          description_html:  job.description_html || null,

          location_raw:      job.location.raw,
          location_type:     job.location.type as any,
          location_country:  job.location.country,
          location_region:   job.location.region,

          employment_type:   normalizeEmploymentType(job.employment_type),
          department:        job.department,
          team:              job.team,

          tech_stack:        job.tech_stack,
          tags:              job.tags,

          comp_min:          job.comp_min,
          comp_max:          job.comp_max,
          comp_currency:     job.comp_currency,
          has_equity:        job.has_equity,

          apply_url:         job.apply_url ?? '',
          source_url:        job.source_url ?? '',

          exact_hash:        job.hashes.exact_hash,
          role_family_hash:  job.hashes.role_family_hash,

          status:           'active',
          first_seen_at:    now,
          last_seen_at:     now,
          source_created_at: job.source_created_at,
          source_updated_at: job.source_updated_at,
        },
        select: { id: true },
      })

      return { outcome: 'new', job_id: created.id }
    } catch (err) {
      // P2002 = unique constraint — another worker beat us to it (race condition).
      // Re-fetch and treat as unchanged.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const race = await prisma.job.findUnique({
          where: { exact_hash: job.hashes.exact_hash },
          select: { id: true },
        })
        if (race) {
          await prisma.job.update({ where: { id: race.id }, data: { last_seen_at: now } })
          return { outcome: 'unchanged', job_id: race.id }
        }
      }
      throw err
    }
  }

  // ── Existing job — detect content change ────────────────────────────────────
  const descriptionChanged =
    existing.description_text !== job.description_text &&
    job.description_text.length > 0

  const techChanged =
    JSON.stringify([...job.tech_stack].sort()) !==
    JSON.stringify([...(existing.tech_stack ?? [])].sort())

  const compChanged =
    existing.comp_min !== job.comp_min || existing.comp_max !== job.comp_max

  const contentChanged = descriptionChanged || techChanged || compChanged

  if (!contentChanged) {
    // ── Unchanged — just heartbeat ────────────────────────────────────────────
    await prisma.job.update({
      where: { id: existing.id },
      data: {
        last_seen_at: now,
        // Re-activate if it had been incorrectly marked closed
        ...(existing.status === 'closed' || existing.status === 'archived'
          ? { status: 'active', closed_at: null }
          : {}),
      },
    })
    return { outcome: 'unchanged', job_id: existing.id }
  }

  // ── Content changed — update + snapshot ────────────────────────────────────
  const diffKeys: string[] = []
  if (descriptionChanged) diffKeys.push('description_text')
  if (techChanged) diffKeys.push('tech_stack')
  if (compChanged) diffKeys.push('comp_min', 'comp_max')

  await prisma.$transaction([
    prisma.job.update({
      where: { id: existing.id },
      data: {
        description_text:  job.description_text,
        description_html:  job.description_html || null,
        tech_stack:        job.tech_stack,
        comp_min:          job.comp_min,
        comp_max:          job.comp_max,
        comp_currency:     job.comp_currency,
        has_equity:        job.has_equity,
        source_updated_at: job.source_updated_at,
        status:            'updated',
        last_seen_at:      now,
      },
    }),
    prisma.jobSnapshot.create({
      data: {
        job_id:      existing.id,
        raw_payload: {
          description_text: job.description_text,
          tech_stack:       job.tech_stack,
          comp_min:         job.comp_min,
          comp_max:         job.comp_max,
        },
        diff_keys: diffKeys,
      },
    }),
  ])

  return { outcome: 'updated', job_id: existing.id }
}

// ─── Close missing jobs ───────────────────────────────────────────────────────

/**
 * After a company poll, close any active jobs whose source_id was NOT in the
 * current ATS response. Uses the "2+ consecutive polls absent" heuristic:
 * only closes jobs whose last_seen_at is older than 2× poll_interval_hours.
 *
 * @param company_id - DB company ID
 * @param current_source_ids - source_ids returned by the ATS in this poll
 * @param poll_interval_hours - company poll cadence
 * @returns Number of jobs closed
 */
export async function closeMissingJobs(
  company_id: string,
  current_source_ids: string[],
  poll_interval_hours: number,
): Promise<number> {
  const thresholdMs = poll_interval_hours * 2 * 60 * 60 * 1000
  const cutoff = new Date(Date.now() - thresholdMs)

  const result = await prisma.job.updateMany({
    where: {
      company_id,
      status: { in: ['active', 'updated', 'discovered'] },
      source_id: { notIn: current_source_ids },
      last_seen_at: { lt: cutoff },
    },
    data: {
      status:    'closed',
      closed_at: new Date(),
    },
  })

  if (result.count > 0) {
    logger.info({ company_id, closed: result.count }, 'Closed missing jobs')
  }

  return result.count
}

// ─── Archive old closed jobs (run daily via scheduler) ───────────────────────

/**
 * Move closed jobs older than 30 days to archived status.
 * Called once per day by the scheduler.
 */
export async function archiveOldClosedJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const result = await prisma.job.updateMany({
    where: {
      status: 'closed',
      closed_at: { lt: cutoff },
    },
    data: { status: 'archived' },
  })

  if (result.count > 0) {
    logger.info({ archived: result.count }, 'Archived old closed jobs')
  }

  return result.count
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeEmploymentType(
  raw: string,
): 'full_time' | 'part_time' | 'contract' | 'internship' | 'unknown' {
  switch (raw) {
    case 'full_time':   return 'full_time'
    case 'part_time':   return 'part_time'
    case 'contract':    return 'contract'
    case 'internship':  return 'internship'
    default:            return 'unknown'
  }
}

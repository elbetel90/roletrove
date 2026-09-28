import { tsClient } from './client'
import { JOBS_COLLECTION } from './schema'
import type { JobDocument } from './schema'

// ─── Single job index ─────────────────────────────────────────────────────────

/**
 * Upsert a single job document into Typesense.
 * Uses `action: upsert` so it works for both new and updated jobs.
 */
export async function indexJob(doc: JobDocument): Promise<void> {
  await tsClient
    .collections<JobDocument>(JOBS_COLLECTION)
    .documents()
    .upsert(doc)
}

/**
 * Remove a job from the Typesense index (called when status → closed/archived).
 * Silently ignores 404 (already deleted).
 */
export async function deleteJob(id: string): Promise<void> {
  try {
    await tsClient.collections(JOBS_COLLECTION).documents(id).delete()
  } catch (err: any) {
    if (err?.httpStatus !== 404) throw err
  }
}

// ─── Bulk import ──────────────────────────────────────────────────────────────

export interface ImportResult {
  success: number
  errors: number
  error_details: string[]
}

/**
 * Bulk-import an array of job documents into Typesense.
 * Uses Typesense's native import endpoint (batch of up to 40MB).
 * Action: upsert (safe to call repeatedly with the same data).
 */
export async function bulkIndexJobs(docs: JobDocument[]): Promise<ImportResult> {
  if (docs.length === 0) return { success: 0, errors: 0, error_details: [] }

  const results = await tsClient
    .collections<JobDocument>(JOBS_COLLECTION)
    .documents()
    .import(docs, { action: 'upsert' })

  let success = 0
  let errors = 0
  const error_details: string[] = []

  for (const result of results) {
    if (result.success) {
      success++
    } else {
      errors++
      if (result.error) error_details.push(result.error)
    }
  }

  return { success, errors, error_details }
}

// ─── Document builder ─────────────────────────────────────────────────────────

/**
 * Build a Typesense JobDocument from a Prisma Job row (with joined Company).
 * `company_name` must be provided via join — it's not on the Job model.
 */
export function buildJobDocument(
  job: {
    id: string
    source_id: string
    source_ats: string
    company_id: string
    title: string
    title_normalized: string
    seniority: string | null
    role_family: string | null
    description_text: string | null
    location_type: string
    location_country: string | null
    location_region: string | null
    location_raw: string | null
    employment_type: string
    department: string | null
    team: string | null
    tech_stack: string[]
    tags: string[]
    comp_min: number | null
    comp_max: number | null
    comp_currency: string | null
    has_equity: boolean
    apply_url: string
    source_url: string
    status: string
    first_seen_at: Date
    last_seen_at: Date
    source_updated_at: Date | null
  },
  company: { slug: string; name: string },
): JobDocument {
  return {
    id:               job.id,
    source_id:        job.source_id,
    source_ats:       job.source_ats,
    company_id:       job.company_id,
    company_slug:     company.slug,
    company_name:     company.name,

    title:            job.title,
    title_normalized: job.title_normalized,
    seniority:        job.seniority ?? 'unknown',
    role_family:      job.role_family ?? 'other',
    description_text: job.description_text ?? undefined,

    location_type:    job.location_type,
    location_country: job.location_country ?? undefined,
    location_region:  job.location_region ?? undefined,
    location_raw:     job.location_raw ?? undefined,

    employment_type:  job.employment_type,
    department:       job.department ?? undefined,
    team:             job.team ?? undefined,

    tech_stack:       job.tech_stack,
    tags:             job.tags.length > 0 ? job.tags : undefined,

    comp_min:         job.comp_min ?? undefined,
    comp_max:         job.comp_max ?? undefined,
    comp_currency:    job.comp_currency ?? undefined,
    has_equity:       job.has_equity,

    apply_url:        job.apply_url,
    source_url:       job.source_url,

    status:           job.status,
    first_seen_at:    job.first_seen_at.getTime(),
    last_seen_at:     job.last_seen_at.getTime(),
    source_updated_at: job.source_updated_at?.getTime(),
  }
}

import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections'

export const JOBS_COLLECTION = 'jobs'

/**
 * Typesense collection schema for job postings.
 *
 * Source of truth is Postgres; this collection is synced via:
 *   - Direct writes from normalize-worker (immediate)
 *   - Sequin CDC (eventual, for recovery / replay)
 *
 * Field design principles:
 *   - facet: true  → enable faceted counts for filter UI
 *   - index: false → store-only fields (not searched or faceted)
 *   - optional: true → field may be absent on some documents
 */
export const JOBS_SCHEMA: CollectionCreateSchema = {
  name: JOBS_COLLECTION,
  // Default sort: newest first
  default_sorting_field: 'first_seen_at',

  fields: [
    // ── Core identifiers ──────────────────────────────────────────────────────
    { name: 'id',           type: 'string' },
    { name: 'source_id',    type: 'string', index: false },
    { name: 'source_ats',   type: 'string', facet: true },
    { name: 'company_id',   type: 'string', index: false },
    { name: 'company_slug', type: 'string', facet: true },
    { name: 'company_name', type: 'string', facet: true },

    // ── Job content ───────────────────────────────────────────────────────────
    { name: 'title',            type: 'string' },
    { name: 'title_normalized', type: 'string' },
    { name: 'seniority',        type: 'string', facet: true },
    { name: 'role_family',      type: 'string', facet: true },
    { name: 'description_text', type: 'string', optional: true, index: true },

    // ── Location ──────────────────────────────────────────────────────────────
    { name: 'location_type',    type: 'string', facet: true },
    { name: 'location_country', type: 'string', facet: true, optional: true },
    { name: 'location_region',  type: 'string', optional: true, index: false },
    { name: 'location_raw',     type: 'string', optional: true, index: false },

    // ── Job metadata ──────────────────────────────────────────────────────────
    { name: 'employment_type', type: 'string', facet: true },
    { name: 'department',      type: 'string', optional: true, index: false },
    { name: 'team',            type: 'string', optional: true, index: false },

    // ── Tech + tags ───────────────────────────────────────────────────────────
    { name: 'tech_stack', type: 'string[]', facet: true },
    { name: 'tags',       type: 'string[]', facet: false, optional: true },

    // ── Compensation ──────────────────────────────────────────────────────────
    { name: 'comp_min',      type: 'int32',  optional: true },
    { name: 'comp_max',      type: 'int32',  optional: true },
    { name: 'comp_currency', type: 'string', optional: true, index: false },
    { name: 'has_equity',    type: 'bool',   facet: true },

    // ── URLs ──────────────────────────────────────────────────────────────────
    { name: 'apply_url',  type: 'string', index: false },
    { name: 'source_url', type: 'string', index: false },

    // ── Status & timestamps (int64 = epoch ms) ────────────────────────────────
    { name: 'status',            type: 'string', facet: true },
    { name: 'first_seen_at',     type: 'int64' },
    { name: 'last_seen_at',      type: 'int64' },
    { name: 'source_updated_at', type: 'int64', optional: true },

    // ── Embedding (Phase 6 — optional until AI matching is built) ─────────────
    {
      name: 'embedding',
      type: 'float[]',
      optional: true,
      num_dim: 1536,
    } as any,
  ],
}

// ─── Document shape stored in Typesense ───────────────────────────────────────

export interface JobDocument {
  id: string
  source_id: string
  source_ats: string
  company_id: string
  company_slug: string
  company_name: string

  title: string
  title_normalized: string
  seniority: string
  role_family: string
  description_text?: string

  location_type: string
  location_country?: string
  location_region?: string
  location_raw?: string

  employment_type: string
  department?: string
  team?: string

  tech_stack: string[]
  tags?: string[]

  comp_min?: number
  comp_max?: number
  comp_currency?: string
  has_equity: boolean

  apply_url: string
  source_url: string

  status: string
  first_seen_at: number    // epoch ms
  last_seen_at: number
  source_updated_at?: number

  embedding?: number[]
}

import { tsClient } from './client'
import { JOBS_COLLECTION } from './schema'
import type { JobDocument } from './schema'
import type { SearchResponse } from 'typesense/lib/Typesense/Documents'

// ─── Search params ────────────────────────────────────────────────────────────

export interface JobSearchParams {
  /** Free-text query (empty string = match all) */
  q?: string
  /** Comma-separated or array of seniority values */
  seniority?: string | string[]
  /** remote | hybrid | onsite | unknown */
  location_type?: string | string[]
  /** Tech stack terms (any-of match) */
  tech_stack?: string | string[]
  /** Filter to a specific company */
  company_slug?: string
  /** Filter to a specific ATS */
  source_ats?: string
  /** Job status (default: active,updated) */
  status?: string | string[]
  /** Role family */
  role_family?: string | string[]
  /** Has salary info */
  has_comp?: boolean
  /** Page (1-indexed) */
  page?: number
  /** Results per page (max 100) */
  limit?: number
  /** Sort: newest | oldest | updated */
  sort?: 'newest' | 'oldest' | 'updated'
}

export interface FacetCount {
  value: string
  count: number
}

export interface JobSearchResult {
  hits: JobDocument[]
  found: number
  page: number
  total_pages: number
  facets: {
    seniority:        FacetCount[]
    role_family:      FacetCount[]
    location_type:    FacetCount[]
    location_country: FacetCount[]
    tech_stack:       FacetCount[]
    source_ats:       FacetCount[]
    company_name:     FacetCount[]
    employment_type:  FacetCount[]
  }
  search_time_ms: number
}

// ─── Search implementation ────────────────────────────────────────────────────

export async function searchJobs(params: JobSearchParams): Promise<JobSearchResult> {
  const limit = Math.min(params.limit ?? 20, 100)
  const page  = Math.max(params.page ?? 1, 1)

  // ── Filter construction ─────────────────────────────────────────────────────
  const filters: string[] = []

  // Status defaults to active + updated if not specified
  const statusArr = normalizeArray(params.status) ?? ['active', 'updated']
  filters.push(buildInFilter('status', statusArr))

  if (params.seniority) {
    filters.push(buildInFilter('seniority', normalizeArray(params.seniority)!))
  }
  if (params.location_type) {
    filters.push(buildInFilter('location_type', normalizeArray(params.location_type)!))
  }
  if (params.tech_stack) {
    const terms = normalizeArray(params.tech_stack)!
    // any-of for tech_stack array field
    filters.push(`tech_stack:=[${terms.map((t) => `\`${t}\``).join(',')}]`)
  }
  if (params.company_slug) {
    filters.push(`company_slug:=${params.company_slug}`)
  }
  if (params.source_ats) {
    filters.push(buildInFilter('source_ats', normalizeArray(params.source_ats)!))
  }
  if (params.role_family) {
    filters.push(buildInFilter('role_family', normalizeArray(params.role_family)!))
  }
  if (params.has_comp === true) {
    filters.push('comp_min:>0')
  }

  // ── Sort ────────────────────────────────────────────────────────────────────
  let sortBy: string
  switch (params.sort) {
    case 'oldest':  sortBy = 'first_seen_at:asc';  break
    case 'updated': sortBy = 'last_seen_at:desc';  break
    default:        sortBy = 'first_seen_at:desc'; break
  }

  // ── Typesense query ─────────────────────────────────────────────────────────
  const searchParams = {
    q:                    params.q || '*',
    query_by:             'title,description_text,company_name,tech_stack',
    query_by_weights:     '4,1,2,2',
    filter_by:            filters.join(' && ') || undefined,
    facet_by:             'seniority,role_family,location_type,location_country,tech_stack,source_ats,company_name,employment_type',
    max_facet_values:     30,
    sort_by:              sortBy,
    page,
    per_page:             limit,
    highlight_full_fields: 'title',
    typo_tokens_threshold: 1,
  } as any

  const res: SearchResponse<JobDocument> = await tsClient
    .collections<JobDocument>(JOBS_COLLECTION)
    .documents()
    .search(searchParams)

  // ── Map facets ──────────────────────────────────────────────────────────────
  const facets: JobSearchResult['facets'] = {
    seniority:        [],
    role_family:      [],
    location_type:    [],
    location_country: [],
    tech_stack:       [],
    source_ats:       [],
    company_name:     [],
    employment_type:  [],
  }

  for (const fc of res.facet_counts ?? []) {
    const key = fc.field_name as keyof typeof facets
    if (key in facets) {
      facets[key] = (fc.counts ?? []).map((c: any) => ({
        value: c.value,
        count: c.count,
      }))
    }
  }

  const hits = (res.hits ?? []).map((h) => h.document)
  const found = res.found ?? 0
  const total_pages = Math.ceil(found / limit)

  return {
    hits,
    found,
    page,
    total_pages,
    facets,
    search_time_ms: res.search_time_ms ?? 0,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeArray(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined
  if (Array.isArray(v)) return v.flatMap((s) => s.split(',').map((x) => x.trim())).filter(Boolean)
  return v.split(',').map((s) => s.trim()).filter(Boolean)
}

function buildInFilter(field: string, values: string[]): string {
  if (values.length === 1) return `${field}:=${values[0]}`
  return `${field}:=[${values.map((v) => `\`${v}\``).join(',')}]`
}

// ─── Primitives ──────────────────────────────────────────────────────────────

export type Seniority = 'intern' | 'junior' | 'mid' | 'senior' | 'staff' | 'unknown'

export type RoleFamily =
  | 'software_engineer'
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'mobile'
  | 'data_engineer'
  | 'ml_engineer'
  | 'devops'
  | 'security'
  | 'product_manager'
  | 'designer'
  | 'other'

export type LocationType = 'remote' | 'hybrid' | 'onsite' | 'unknown'

export type AtsType =
  | 'greenhouse'
  | 'ashby'
  | 'lever'
  | 'workable'
  | 'smartrecruiters'
  | 'workday'
  | 'icims'
  | 'successfactors'
  | 'taleo'
  | 'unknown'

// ─── Parsed Location ─────────────────────────────────────────────────────────

export interface ParsedLocation {
  raw: string
  type: LocationType
  country: string | null
  region: string | null
  timezone_hint: string | null
}

// ─── Dedup Hashes ────────────────────────────────────────────────────────────

export interface JobHashes {
  exact_hash: string
  role_family_hash: string
}

// ─── Canonical Job Record ─────────────────────────────────────────────────────

export interface JobRecord {
  source_id: string
  source_ats: AtsType
  company_slug: string

  title: string
  title_normalized: string
  seniority: Seniority
  role_family: RoleFamily

  description_text: string
  description_html: string

  location: ParsedLocation

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

  source_created_at: Date | null
  source_updated_at: Date | null

  hashes: JobHashes
}

// ─── Company Seed Record ──────────────────────────────────────────────────────

export interface CompanySeed {
  slug: string
  name: string
  domain: string | null
  ats_type: AtsType
  ats_token: string
}

// ─── Crawl Result ─────────────────────────────────────────────────────────────

export interface CrawlResult {
  company_slug: string
  ats_type: AtsType
  jobs_found: number
  jobs_new: number
  jobs_updated: number
  jobs_closed: number
  duration_ms: number
  error?: string
}

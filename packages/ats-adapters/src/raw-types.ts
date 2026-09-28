// ─── Greenhouse ──────────────────────────────────────────────────────────────
// Source: GET boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true

export interface RawGreenhouseDepartment {
  id: number
  name: string
  parent_id: number | null
  child_ids: number[]
}

export interface RawGreenhouseOffice {
  id: number
  name: string
  location: string | null
  parent_id: number | null
  child_ids: number[]
}

export interface RawGreenhouseJob {
  id: number
  title: string
  location: { name: string }
  absolute_url: string
  updated_at: string          // ISO 8601
  first_published: string     // ISO 8601
  content: string             // HTML (populated when ?content=true)
  departments: RawGreenhouseDepartment[]
  offices: RawGreenhouseOffice[]
  metadata: unknown | null
  requisition_id: string | null
  internal_job_id: number | null
  language: string
  company_name: string | null
}

export interface GreenhouseResponse {
  jobs: RawGreenhouseJob[]
  meta: { total: number }
}

// ─── Ashby ───────────────────────────────────────────────────────────────────
// Source: GET api.ashbyhq.com/posting-api/job-board/{token}

export interface RawAshbyJob {
  id: string                           // UUID
  title: string
  department: string | null            // e.g. "Engineering"
  team: string | null                  // e.g. "Backend"
  location: string | null              // e.g. "Remote (EMEA)"
  isRemote: boolean
  workplaceType: string | null         // "Remote" | "Hybrid" | "OnSite"
  employmentType: string | null        // "FullTime" | "PartTime" | "Contract" | "Internship" | "Temporary"
  compensationTierSummary: string | null  // e.g. "$150K – $200K USD" (present on some boards)
  descriptionHtml: string
  descriptionPlain: string
  jobUrl: string                       // canonical job URL
  applyUrl: string
  publishedAt: string                  // ISO 8601
  updatedAt?: string                   // ISO 8601 (not always present)
  secondaryLocations?: Array<{ location: string; isRemote: boolean }>
  address?: {
    postalAddress?: {
      addressCountry?: string
      addressRegion?: string
    }
  }
}

export interface AshbyResponse {
  /** API v2+ uses "jobs" key; kept as union for resilience */
  jobs?: RawAshbyJob[]
  jobPostings?: RawAshbyJob[]         // older boards
  apiVersion?: string
}

// ─── Lever ───────────────────────────────────────────────────────────────────
// Source: GET api.lever.co/v0/postings/{token}?mode=json

export interface RawLeverCategories {
  team: string | null
  department: string | null
  location: string | null
  commitment: string | null  // "Full-time" | "Part-time" | "Contract" | "Intern" | "Internship"
  allLocations?: string[]
}

export interface RawLeverJob {
  id: string              // UUID
  text: string            // job title
  categories: RawLeverCategories
  createdAt: number       // epoch ms
  updatedAt?: number      // epoch ms (not always present)
  hostedUrl: string
  applyUrl: string
  descriptionPlain: string
  description: string     // HTML
  lists: Array<{
    text: string          // section heading e.g. "Responsibilities"
    content: string       // HTML content of that section
  }>
  additional: string      // extra HTML appended after lists
  tags: string[]
  salaryRange?: {
    min: number | null
    max: number | null
    currency: string | null
    interval: string | null  // "per-year" | "per-month" etc.
  }
}

// ─── Workable ────────────────────────────────────────────────────────────────
// Source: POST apply.workable.com/api/v3/accounts/{token}/jobs

export interface RawWorkableJob {
  id: string
  title: string
  full_title: string
  shortcode: string
  code: string
  state: string            // "published"
  department: string | null
  department_hierarchy: Array<{ id: string; name: string }>
  url: string
  application_url: string
  shortlink: string
  location: {
    location_str: string
    country: string | null
    country_code: string | null
    region: string | null
    region_code: string | null
    city: string | null
    zip_code: string | null
    telecommuting: boolean
  }
  created_at: string       // ISO 8601
}

export interface WorkableJobsResponse {
  results: RawWorkableJob[]
  total: number
  next: string | null      // cursor for next page
}

// Workable job detail — returned by GET /api/v3/accounts/{token}/jobs/{shortcode}
// Extends the list shape with full HTML description fields.

export interface WorkableJobDetail extends RawWorkableJob {
  full_description?: string    // HTML — full combined job description
  description?: string         // HTML — teaser/intro description
  requirements?: string        // HTML — requirements section
  benefits?: string            // HTML — benefits section
}

// ─── SmartRecruiters ─────────────────────────────────────────────────────────
// Source: GET api.smartrecruiters.com/v1/companies/{token}/postings

export interface RawSmartRecruitersJob {
  id: string
  name: string             // job title
  department: { id: string; label: string } | null
  location: {
    city: string | null
    region: string | null
    country: string | null
    remote: boolean
    remoteDetails?: { url: string | null }
  }
  experienceLevel: { id: string; label: string } | null
  typeOfEmployment: { id: string; label: string } | null
  ref: string              // apply URL
  refNumber: string
  releasedDate: string     // ISO 8601
  updateDate: string       // ISO 8601
}

export interface SmartRecruitersResponse {
  offset: number
  limit: number
  totalFound: number
  content: RawSmartRecruitersJob[]
}

// SmartRecruiters job detail — returned by GET /v1/companies/{co}/postings/{id}
// Extends the list shape with jobAd.sections (HTML description content).

export interface SmartRecruitersJobSection {
  title: string
  text: string  // HTML
}

export interface SmartRecruitersJobDetail extends RawSmartRecruitersJob {
  jobAd?: {
    sections?: {
      companyDescription?:     SmartRecruitersJobSection
      jobDescription?:         SmartRecruitersJobSection
      qualifications?:         SmartRecruitersJobSection
      additionalInformation?:  SmartRecruitersJobSection
    }
  }
}

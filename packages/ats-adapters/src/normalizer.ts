import he from 'he'
import {
  normalizeTitle,
  htmlToText,
  extractSeniority,
  extractRoleFamily,
  parseLocation,
  toLocationBucket,
  extractTechStack,
  computeHashes,
  type JobRecord,
  type Seniority,
  type RoleFamily,
} from '@roletrove/shared'
import { parseCompensation, parseLeverSalaryRange, fitInt4 } from './compensation'
import type {
  RawGreenhouseJob,
  RawAshbyJob,
  RawLeverJob,
  SmartRecruitersJobDetail,
} from './raw-types'

// ─── Employment type mappers ──────────────────────────────────────────────────

const ASHBY_EMPLOYMENT_MAP: Record<string, string> = {
  FullTime: 'full_time',
  'Full-time': 'full_time',
  PartTime: 'part_time',
  'Part-time': 'part_time',
  Contract: 'contract',
  Internship: 'internship',
  Temporary: 'contract',
}

const SMARTRECRUITERS_EMPLOYMENT_MAP: Record<string, string> = {
  permanent:    'full_time',
  'full-time':  'full_time',
  full_time:    'full_time',
  temporary:    'contract',
  contract:     'contract',
  freelance:    'contract',
  internship:   'internship',
  'part-time':  'part_time',
  part_time:    'part_time',
}

const LEVER_COMMITMENT_MAP: Record<string, string> = {
  'Full-time': 'full_time',
  'Part-time': 'part_time',
  Contract: 'contract',
  Intern: 'internship',
  Internship: 'internship',
  Temporary: 'contract',
  Freelance: 'contract',
}

function mapEmploymentType(raw: string | null | undefined, map: Record<string, string>): string {
  if (!raw) return 'unknown'
  return map[raw] ?? map[raw.trim()] ?? 'unknown'
}

// ─── Shared pipeline helper ───────────────────────────────────────────────────

interface PipelineInput {
  title: string
  description_html: string
  location_raw: string | null
  employment_type_raw: string
  source_id: string
  source_ats: JobRecord['source_ats']
  company_slug: string
  department: string | null
  team: string | null
  apply_url: string
  source_url: string
  source_created_at: Date | null
  source_updated_at: Date | null
  // Optional overrides from ATS-native fields
  comp_override?: {
    comp_min: number | null
    comp_max: number | null
    comp_currency: string | null
  }
  tags?: string[]
}

function runPipeline(input: PipelineInput): JobRecord {
  const title_normalized = normalizeTitle(input.title)
  const seniority: Seniority = extractSeniority(input.title)
  const role_family: RoleFamily = extractRoleFamily(input.title)

  const description_text = htmlToText(input.description_html)
  const location = parseLocation(input.location_raw)
  const location_bucket = toLocationBucket(location)

  const tech_stack = extractTechStack(description_text)

  // Compensation: prefer ATS-native override, fall back to text parsing
  const comp_from_text = parseCompensation(description_text)
  const comp = input.comp_override ?? comp_from_text

  const hashes = computeHashes({
    company_slug: input.company_slug,
    title_normalized,
    location_bucket,
    role_family,
    department: input.department,
  })

  return {
    source_id: input.source_id,
    source_ats: input.source_ats,
    company_slug: input.company_slug,

    title: input.title,
    title_normalized,
    seniority,
    role_family,

    description_html: input.description_html,
    description_text,

    location,

    employment_type: input.employment_type_raw,
    department: input.department,
    team: input.team,

    tech_stack,
    tags: input.tags ?? [],

    comp_min: fitInt4(comp.comp_min),
    comp_max: fitInt4(comp.comp_max),
    comp_currency: comp.comp_currency,
    has_equity: comp_from_text.has_equity,

    apply_url: input.apply_url,
    source_url: input.source_url,

    source_created_at: input.source_created_at,
    source_updated_at: input.source_updated_at,

    hashes,
  }
}

// ─── Greenhouse normalizer ────────────────────────────────────────────────────

/**
 * Decode HTML entities so raw ATS HTML (e.g. &lt;p&gt;) becomes real HTML (<p>).
 * Some ATS platforms (notably Greenhouse) return entity-encoded HTML strings.
 */
function decodeHtml(raw: string): string {
  return he.decode(raw)
}

/**
 * Normalize a raw Greenhouse job into a canonical JobRecord.
 */
export function normalizeGreenhouse(
  raw: RawGreenhouseJob,
  company_slug: string,
): JobRecord {
  // Greenhouse returns entity-encoded HTML (e.g. &lt;p&gt;) — decode to real HTML
  const description_html = decodeHtml(raw.content ?? '')

  return runPipeline({
    source_id: String(raw.id),
    source_ats: 'greenhouse',
    company_slug,
    title: raw.title,
    description_html,
    location_raw: raw.location?.name ?? null,
    employment_type_raw: 'unknown', // Greenhouse doesn't expose this in the board API
    department: raw.departments?.[0]?.name ?? null,
    team: null,
    apply_url: raw.absolute_url,
    source_url: raw.absolute_url,
    source_created_at: raw.first_published ? new Date(raw.first_published) : null,
    source_updated_at: raw.updated_at ? new Date(raw.updated_at) : null,
  })
}

// ─── Ashby normalizer ─────────────────────────────────────────────────────────

/**
 * Normalize a raw Ashby job into a canonical JobRecord.
 */
export function normalizeAshby(
  raw: RawAshbyJob,
  company_slug: string,
): JobRecord {
  // Ashby exposes isRemote directly — use it to enrich location_raw
  const location_raw = raw.location
    ? raw.isRemote && !raw.location.toLowerCase().includes('remote')
      ? `Remote - ${raw.location}`
      : raw.location
    : raw.isRemote
      ? 'Remote'
      : null

  // Ashby provides compensationTierSummary natively (e.g. "$150K – $200K USD")
  const comp_override = raw.compensationTierSummary
    ? parseCompensation(raw.compensationTierSummary)
    : undefined

  return runPipeline({
    source_id: raw.id,
    source_ats: 'ashby',
    company_slug,
    title: raw.title,
    description_html: decodeHtml(raw.descriptionHtml ?? ''),
    location_raw,
    employment_type_raw: mapEmploymentType(raw.employmentType, ASHBY_EMPLOYMENT_MAP),
    department: raw.department ?? null,
    team: raw.team ?? null,
    apply_url: raw.applyUrl,
    source_url: raw.jobUrl,
    source_created_at: raw.publishedAt ? new Date(raw.publishedAt) : null,
    source_updated_at: raw.updatedAt ? new Date(raw.updatedAt) : null,
    comp_override: comp_override
      ? {
          comp_min: comp_override.comp_min,
          comp_max: comp_override.comp_max,
          comp_currency: comp_override.comp_currency,
        }
      : undefined,
  })
}

// ─── Lever normalizer ─────────────────────────────────────────────────────────

/**
 * Normalize a raw Lever job into a canonical JobRecord.
 *
 * Lever's description field is HTML. The lists[] sections (Responsibilities,
 * Requirements, etc.) are separate HTML fragments — we concatenate them into
 * the main description so tech-stack extraction sees the full content.
 */
export function normalizeLever(
  raw: RawLeverJob,
  company_slug: string,
): JobRecord {
  // Concatenate description + list sections + additional for full content
  const listHtml = (raw.lists ?? [])
    .map((l) => `<h3>${l.text}</h3>${l.content}`)
    .join('\n')
  const description_html = decodeHtml(
    [raw.description ?? '', listHtml, raw.additional ?? ''].filter(Boolean).join('\n'),
  )

  // Prefer Lever's native salaryRange if present
  const nativeSalary = parseLeverSalaryRange(raw.salaryRange)
  const hasNativeSalary =
    nativeSalary.comp_min !== null || nativeSalary.comp_max !== null

  return runPipeline({
    source_id: raw.id,
    source_ats: 'lever',
    company_slug,
    title: raw.text,
    description_html,
    location_raw: raw.categories?.location ?? null,
    employment_type_raw: mapEmploymentType(
      raw.categories?.commitment,
      LEVER_COMMITMENT_MAP,
    ),
    department: raw.categories?.department ?? null,
    team: raw.categories?.team ?? null,
    apply_url: raw.applyUrl,
    source_url: raw.hostedUrl,
    source_created_at: raw.createdAt ? new Date(raw.createdAt) : null,
    source_updated_at: raw.updatedAt ? new Date(raw.updatedAt) : null,
    comp_override: hasNativeSalary ? nativeSalary : undefined,
    tags: raw.tags ?? [],
  })
}

// ─── SmartRecruiters normalizer ───────────────────────────────────────────────

/**
 * Normalize a SmartRecruiters job (with optional detail sections) into a
 * canonical JobRecord.
 *
 * The list endpoint returns minimal metadata; the detail endpoint adds
 * jobAd.sections with HTML descriptions. Both shapes are handled gracefully.
 */
export function normalizeSmartRecruiters(
  raw: SmartRecruitersJobDetail,
  company_slug: string,
): JobRecord {
  // Build description from jobAd sections (detail endpoint)
  const sections = raw.jobAd?.sections ?? {}
  const descParts = [
    sections.companyDescription?.text,
    sections.jobDescription?.text,
    sections.qualifications?.text,
    sections.additionalInformation?.text,
  ].filter((s): s is string => Boolean(s))
  const description_html = decodeHtml(descParts.join('\n'))

  // Build location string
  const loc = raw.location
  const locParts = [loc.city, loc.region, loc.country].filter(Boolean)
  const location_raw = loc.remote
    ? locParts.length > 0
      ? `Remote - ${locParts.join(', ')}`
      : 'Remote'
    : locParts.join(', ') || null

  return runPipeline({
    source_id: raw.id,
    source_ats: 'smartrecruiters',
    company_slug,
    title: raw.name,
    description_html,
    location_raw,
    employment_type_raw: mapEmploymentType(
      raw.typeOfEmployment?.label?.toLowerCase(),
      SMARTRECRUITERS_EMPLOYMENT_MAP,
    ),
    department: raw.department?.label ?? null,
    team: null,
    apply_url: raw.ref,
    source_url: raw.ref,
    source_created_at: raw.releasedDate ? new Date(raw.releasedDate) : null,
    source_updated_at: raw.updateDate ? new Date(raw.updateDate) : null,
  })
}

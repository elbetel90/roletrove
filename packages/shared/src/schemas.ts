import { z } from 'zod'

// ─── Primitive Enums ─────────────────────────────────────────────────────────

export const SenioritySchema = z.enum([
  'intern',
  'junior',
  'mid',
  'senior',
  'staff',
  'unknown',
])

export const RoleFamilySchema = z.enum([
  'software_engineer',
  'frontend',
  'backend',
  'fullstack',
  'mobile',
  'data_engineer',
  'ml_engineer',
  'devops',
  'security',
  'product_manager',
  'designer',
  'other',
])

export const LocationTypeSchema = z.enum(['remote', 'hybrid', 'onsite', 'unknown'])

export const AtsTypeSchema = z.enum([
  'greenhouse',
  'ashby',
  'lever',
  'workable',
  'smartrecruiters',
  'workday',
  'icims',
  'successfactors',
  'taleo',
  'unknown',
])

// ─── Parsed Location ─────────────────────────────────────────────────────────

export const ParsedLocationSchema = z.object({
  raw: z.string(),
  type: LocationTypeSchema,
  country: z.string().nullable(),
  region: z.string().nullable(),
  timezone_hint: z.string().nullable(),
})

// ─── Job Hashes ──────────────────────────────────────────────────────────────

export const JobHashesSchema = z.object({
  exact_hash: z.string().length(64),
  role_family_hash: z.string().length(64),
})

// ─── Canonical JobRecord ──────────────────────────────────────────────────────

export const JobRecordSchema = z.object({
  source_id: z.string().min(1),
  source_ats: AtsTypeSchema,
  company_slug: z.string().min(1),

  title: z.string().min(1),
  title_normalized: z.string(),
  seniority: SenioritySchema,
  role_family: RoleFamilySchema,

  description_text: z.string(),
  description_html: z.string(),

  location: ParsedLocationSchema,

  employment_type: z.string(),
  department: z.string().nullable(),
  team: z.string().nullable(),

  tech_stack: z.array(z.string()),
  tags: z.array(z.string()),

  comp_min: z.number().int().positive().nullable(),
  comp_max: z.number().int().positive().nullable(),
  comp_currency: z.string().length(3).nullable(),
  has_equity: z.boolean(),

  apply_url: z.string().url(),
  source_url: z.string().url(),

  source_created_at: z.date().nullable(),
  source_updated_at: z.date().nullable(),

  hashes: JobHashesSchema,
})

export type JobRecordInput = z.input<typeof JobRecordSchema>
export type JobRecordOutput = z.output<typeof JobRecordSchema>

// ─── Saved Search Filters ────────────────────────────────────────────────────

export const SavedSearchFiltersSchema = z.object({
  q: z.string().optional(),
  seniority: z.array(SenioritySchema).optional(),
  location_type: z.array(LocationTypeSchema).optional(),
  tech_stack: z.array(z.string()).optional(),
  company_slug: z.string().optional(),
  source_ats: z.array(AtsTypeSchema).optional(),
  posted_within_days: z.number().int().positive().optional(),
})

export type SavedSearchFilters = z.infer<typeof SavedSearchFiltersSchema>

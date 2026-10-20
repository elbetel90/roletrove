import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { computeHashes } from '@roletrove/shared'
import type { JobRecord } from '@roletrove/shared'

function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envFile = resolve(import.meta.dirname, '../../../.env')
  if (!existsSync(envFile)) return undefined
  const match = readFileSync(envFile, 'utf8').match(/^DATABASE_URL=(.+)$/m)
  const value = match?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (value) process.env.DATABASE_URL = value
  return value
}

const DATABASE_URL = databaseUrl()

function record(
  slug: string,
  source_id: string,
  title: string,
  locationRaw: string,
  comp_max: number | null = 180_000,
): JobRecord {
  const title_normalized = title.toLowerCase()
  const hashes = computeHashes({
    company_slug: slug,
    title_normalized,
    location_bucket: locationRaw,
    role_family: 'software_engineer',
    department: null,
  })

  return {
    source_id,
    source_ats: 'greenhouse',
    company_slug: slug,
    title,
    title_normalized,
    seniority: 'senior',
    role_family: 'software_engineer',
    description_text: 'Build things.',
    description_html: '<p>Build things.</p>',
    location: {
      raw: locationRaw,
      type: 'remote',
      country: 'US',
      region: null,
      timezone_hint: null,
    },
    employment_type: 'full_time',
    department: null,
    team: null,
    tech_stack: ['typescript'],
    tags: [],
    comp_min: null,
    comp_max,
    comp_currency: 'USD',
    has_equity: false,
    apply_url: 'https://example.com/apply',
    source_url: 'https://example.com/job',
    source_created_at: null,
    source_updated_at: null,
    hashes,
  }
}

test('upsertJob uses ATS source id and clamps overflow salaries', async (t) => {
  if (!DATABASE_URL) {
    t.skip('DATABASE_URL is required')
    return
  }

  const { prisma } = await import('@roletrove/db')
  const { upsertJob } = await import('../src/state-machine')

  const slug = `_test_upsert_${Date.now()}`
  const company = await prisma.company.create({
    data: {
      slug,
      name: 'Upsert Test',
      domain: 'example.test',
      ats_type: 'greenhouse',
      ats_token: 'verify',
    },
  })

  t.after(async () => {
    await prisma.jobSnapshot.deleteMany({ where: { job: { company_id: company.id } } })
    await prisma.job.deleteMany({ where: { company_id: company.id } })
    await prisma.company.delete({ where: { id: company.id } })
    await prisma.$disconnect()
  })

  const created = await upsertJob(record(slug, 'gh-1', 'Staff Engineer', 'remote-us'), company.id)
  assert.equal(created.outcome, 'new')

  const updated = await upsertJob(
    record(slug, 'gh-1', 'Staff Engineer (Remote)', 'remote-gb'),
    company.id,
  )
  assert.equal(updated.outcome, 'updated')
  assert.equal(updated.job_id, created.job_id)

  const sameHash = await upsertJob(
    record(slug, 'gh-2', 'Staff Engineer (Remote)', 'remote-gb'),
    company.id,
  )
  assert.equal(sameHash.outcome, 'new')
  assert.notEqual(sameHash.job_id, created.job_id)

  const overflow = await upsertJob(
    record(slug, 'gh-3', 'Principal Engineer', 'remote-us', 11_000_000_000),
    company.id,
  )
  assert.equal(overflow.outcome, 'new')
  const overflowRow = await prisma.job.findUniqueOrThrow({ where: { id: overflow.job_id } })
  assert.equal(overflowRow.comp_max, null)

  const count = await prisma.job.count({ where: { company_id: company.id } })
  assert.equal(count, 3)
})

/**
 * Phase 2 — ATS Adapter smoke test
 *
 * Fetches 3 live jobs per ATS and prints a verification table.
 *
 * Usage (from repo root):
 *   pnpm --filter @roletrove/ats-adapters exec tsx scripts/test-adapters.ts
 *
 * Or directly:
 *   cd packages/ats-adapters && npx tsx scripts/test-adapters.ts
 */

import { fetchGreenhouseJobs } from '../src/greenhouse'
import { fetchAshbyJobs } from '../src/ashby'
import { fetchLeverJobs } from '../src/lever'
import { normalizeGreenhouse, normalizeAshby, normalizeLever } from '../src/normalizer'
import type { JobRecord } from '@roletrove/shared'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const FIXTURES = [
  { ats: 'greenhouse', company: 'stripe',  token: 'stripe'  },
  { ats: 'ashby',      company: 'posthog', token: 'posthog' },
  { ats: 'lever',      company: 'spotify',  token: 'spotify' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max = 40): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (Array.isArray(v)) return v.length ? v.slice(0, 3).join(', ') + (v.length > 3 ? '…' : '') : '—'
  return String(v)
}

function printTable(rows: Array<Record<string, string>>): void {
  if (rows.length === 0) return

  const cols = Object.keys(rows[0])
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => (r[c] ?? '').length)),
  )

  const hr = widths.map((w) => '─'.repeat(w + 2)).join('┼')
  const header = cols.map((c, i) => ` ${c.padEnd(widths[i])} `).join('│')
  const sep = widths.map((w) => '─'.repeat(w + 2)).join('┼')

  console.log('┌' + hr + '┐')
  console.log('│' + header + '│')
  console.log('├' + sep + '┤')
  for (const row of rows) {
    const line = cols.map((c, i) => ` ${(row[c] ?? '').padEnd(widths[i])} `).join('│')
    console.log('│' + line + '│')
  }
  console.log('└' + widths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘')
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function testAts(
  ats: string,
  company: string,
  token: string,
): Promise<void> {
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  ATS: ${ats.toUpperCase()}   Company: ${company}   Token: ${token}`)
  console.log('═'.repeat(70))

  let jobs: JobRecord[]

  try {
    if (ats === 'greenhouse') {
      const raw = await fetchGreenhouseJobs(token)
      console.log(`  → Fetched ${raw.length} raw jobs`)
      jobs = raw.slice(0, 3).map((j) => normalizeGreenhouse(j, company))
    } else if (ats === 'ashby') {
      const raw = await fetchAshbyJobs(token)
      console.log(`  → Fetched ${raw.length} raw jobs`)
      jobs = raw.slice(0, 3).map((j) => normalizeAshby(j, company))
    } else {
      const raw = await fetchLeverJobs(token)
      console.log(`  → Fetched ${raw.length} raw jobs`)
      jobs = raw.slice(0, 3).map((j) => normalizeLever(j, company))
    }
  } catch (err) {
    console.error(`  ✗ ERROR:`, err)
    return
  }

  if (jobs.length === 0) {
    console.log('  (no active jobs found)')
    return
  }

  const rows = jobs.map((j) => ({
    'ID':            truncate(j.source_id, 20),
    'Title':         truncate(j.title, 36),
    'Seniority':     j.seniority,
    'Role Family':   j.role_family,
    'Location Type': j.location.type,
    'Country':       j.location.country ?? '—',
    'Emp Type':      j.employment_type,
    'Dept':          truncate(j.department ?? '—', 20),
    'Tech (top 3)':  fmt(j.tech_stack),
    'Comp Min':      j.comp_min !== null ? `${j.comp_currency ?? '?'} ${j.comp_min.toLocaleString()}` : '—',
    'Comp Max':      j.comp_max !== null ? `${j.comp_currency ?? '?'} ${j.comp_max.toLocaleString()}` : '—',
    'Equity':        j.has_equity ? '✓' : '—',
    'Hash (short)':  j.hashes.exact_hash.slice(0, 12),
  }))

  printTable(rows)
}

async function main(): Promise<void> {
  console.log('\nPhase 2 — ATS Adapter smoke test')
  console.log('─'.repeat(70))

  const start = Date.now()

  for (const { ats, company, token } of FIXTURES) {
    await testAts(ats, company, token)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✓ Done in ${elapsed}s\n`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})

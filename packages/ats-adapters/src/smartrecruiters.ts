import { fetch } from 'undici'
import { USER_AGENT, AtsHttpError, AtsParseError } from './errors'
import type {
  RawSmartRecruitersJob,
  SmartRecruitersResponse,
  SmartRecruitersJobDetail,
} from './raw-types'

const BASE_URL = 'https://api.smartrecruiters.com/v1/companies'
const PAGE_SIZE = 100

// ─── Detail fetcher ───────────────────────────────────────────────────────────

/**
 * Fetch full job detail (including description sections) for a single posting.
 * Returns null on any error so the caller can fall back to list-only data.
 */
async function fetchJobDetail(
  company: string,
  jobId: string,
): Promise<SmartRecruitersJobDetail | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/${encodeURIComponent(company)}/postings/${encodeURIComponent(jobId)}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      },
    )
    if (!res.ok) return null
    return (await res.json()) as SmartRecruitersJobDetail
  } catch {
    return null
  }
}

// ─── Main fetcher ─────────────────────────────────────────────────────────────

/**
 * Fetch all active job postings for a SmartRecruiters company.
 *
 * Strategy:
 *   1. Paginate through the public postings list endpoint.
 *   2. Enrich each job with its detail (jobAd.sections) at concurrency 5,
 *      with a 1-second pause between batches to stay within 60 rpm.
 *
 * @param token - SmartRecruiters company identifier (e.g. "bosch")
 * @returns Array of enriched SmartRecruiters job objects
 *
 * Rate limit: 60 req/min (enforced by token bucket in fetch-worker + internal
 * detail-fetch throttling here)
 */
export async function fetchSmartRecruitersJobs(
  token: string,
): Promise<SmartRecruitersJobDetail[]> {
  // ── 1. Fetch all pages of the job listing ──────────────────────────────────
  const all: RawSmartRecruitersJob[] = []
  let offset = 0

  while (true) {
    const url =
      `${BASE_URL}/${encodeURIComponent(token)}/postings` +
      `?limit=${PAGE_SIZE}&offset=${offset}`

    let res: Awaited<ReturnType<typeof fetch>>
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      })
    } catch {
      throw new AtsHttpError('smartrecruiters', 0, token)
    }

    if (!res.ok) {
      throw new AtsHttpError('smartrecruiters', res.status, token)
    }

    let data: unknown
    try {
      data = await res.json()
    } catch (err) {
      throw new AtsParseError('smartrecruiters', token, err)
    }

    const response = data as SmartRecruitersResponse

    if (!Array.isArray(response.content)) {
      throw new AtsParseError(
        'smartrecruiters',
        token,
        new Error('Unexpected response shape — missing content array'),
      )
    }

    all.push(...response.content)

    const total = response.totalFound ?? 0
    if (all.length >= total || response.content.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  if (all.length === 0) return []

  // ── 2. Enrich with job descriptions (sequential, 1 s per request ≈ 60 rpm)
  // SmartRecruiters rate limit: 60 rpm = 1 req/s.
  // Sequential fetching with 1 s delay keeps us precisely at quota.
  const BATCH_SIZE = 1
  const BATCH_DELAY_MS = 1_000
  const enriched: SmartRecruitersJobDetail[] = []

  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE)

    const details = await Promise.all(
      batch.map((job) => fetchJobDetail(token, job.id)),
    )

    for (let j = 0; j < batch.length; j++) {
      // Merge detail fields over list fields (detail is a superset)
      enriched.push(
        details[j] ?? (batch[j] as SmartRecruitersJobDetail),
      )
    }

    // Throttle: skip delay after the last batch
    if (i + BATCH_SIZE < all.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  return enriched
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

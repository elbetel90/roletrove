import { fetch } from 'undici'
import { USER_AGENT, AtsHttpError, AtsParseError } from './errors'
import type { RawWorkableJob, WorkableJobsResponse, WorkableJobDetail } from './raw-types'

const BASE_URL = 'https://apply.workable.com/api/v3/accounts'

interface WorkableOptions {
  /** Maximum jobs to fetch (default: unlimited) */
  limit?: number
}

// ─── Detail fetcher ───────────────────────────────────────────────────────────

/**
 * Fetch full Workable job detail including description HTML.
 * Returns null on any error so the caller falls back to list-only data.
 *
 * @param token    - Workable account slug
 * @param shortcode - Unique job shortcode from the list response
 */
async function fetchWorkableJobDetail(
  token: string,
  shortcode: string,
): Promise<WorkableJobDetail | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/${encodeURIComponent(token)}/jobs/${encodeURIComponent(shortcode)}`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      },
    )
    if (!res.ok) return null
    return (await res.json()) as WorkableJobDetail
  } catch {
    return null
  }
}

/**
 * Fetch all active job postings for a Workable account.
 *
 * Workable uses POST + cursor-based pagination:
 *   POST /api/v3/accounts/{token}/jobs
 *   Body: { "query": "", "location": [], "department": [], "remote": [] }
 *   Response: { results, total, next }
 *
 * @param token - The Workable account slug (e.g. "figma")
 * @returns Array of raw Workable job objects (typed, unnormalized)
 *
 * Rate limit: ~30 req/min (enforced by worker rate limiter in Phase 3)
 */
export async function fetchWorkableJobs(
  token: string,
  options: WorkableOptions = {},
): Promise<WorkableJobDetail[]> {
  const { limit = Infinity } = options
  const all: RawWorkableJob[] = []
  let nextCursor: string | null = null
  let page = 0

  do {
    const url = `${BASE_URL}/${encodeURIComponent(token)}/jobs`

    const body: Record<string, unknown> = {
      query: '',
      location: [],
      department: [],
      remote: [],
      ...(nextCursor ? { token: nextCursor } : {}),
    }

    let res: Awaited<ReturnType<typeof fetch>>
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      throw new AtsHttpError('workable', 0, token)
    }

    if (!res.ok) {
      throw new AtsHttpError('workable', res.status, token)
    }

    let data: unknown
    try {
      data = await res.json()
    } catch (err) {
      throw new AtsParseError('workable', token, err)
    }

    const response = data as WorkableJobsResponse

    if (!Array.isArray(response.results)) {
      throw new AtsParseError('workable', token, new Error('Unexpected response shape'))
    }

    all.push(...response.results)
    nextCursor = response.next ?? null
    page++

    // Safety: bail if we've hit the requested limit
    if (all.length >= limit) break
  } while (nextCursor !== null)

  const base = limit < Infinity ? all.slice(0, limit) : all

  // ── Enrich with descriptions (sequential, 2 s per request ≈ 30 rpm)
  // Workable rate limit: 30 rpm — 1 detail req every 2s = 30 rpm exactly.
  // We use batch of 1 to avoid bursting over the limit.
  const BATCH_SIZE = 1
  const BATCH_DELAY_MS = 2_000
  const enriched: WorkableJobDetail[] = []

  for (let i = 0; i < base.length; i += BATCH_SIZE) {
    const batch = base.slice(i, i + BATCH_SIZE)

    const details = await Promise.all(
      batch.map((job) => fetchWorkableJobDetail(token, job.shortcode)),
    )

    for (let j = 0; j < batch.length; j++) {
      enriched.push(details[j] ?? (batch[j] as WorkableJobDetail))
    }

    if (i + BATCH_SIZE < base.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  return enriched
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

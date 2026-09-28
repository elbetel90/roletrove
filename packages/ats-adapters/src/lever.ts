import { fetch } from 'undici'
import { USER_AGENT, AtsHttpError, AtsParseError } from './errors'
import type { RawLeverJob } from './raw-types'

const BASE_URL = 'https://api.lever.co/v0/postings'

/**
 * Fetch all active job postings for a Lever board.
 *
 * @param token - The Lever company slug (e.g. "vercel", "cursor")
 * @returns Array of raw Lever job objects (typed, unnormalized)
 *
 * Rate limit: ~120 req/min (more permissive; enforced by worker rate limiter in Phase 3)
 * Pagination: none — single call returns all postings (can be thousands)
 * Note: ?mode=json is required; default response is HTML
 */
export async function fetchLeverJobs(token: string): Promise<RawLeverJob[]> {
  const url = `${BASE_URL}/${encodeURIComponent(token)}?mode=json`

  let res: Awaited<ReturnType<typeof fetch>>
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    })
  } catch (err) {
    throw new AtsHttpError('lever', 0, token)
  }

  if (!res.ok) {
    throw new AtsHttpError('lever', res.status, token)
  }

  let data: unknown
  try {
    data = await res.json()
  } catch (err) {
    throw new AtsParseError('lever', token, err)
  }

  // Lever returns a flat JSON array (not wrapped in an object)
  if (!Array.isArray(data)) {
    throw new AtsParseError('lever', token, new Error('Expected array response'))
  }

  return data as RawLeverJob[]
}

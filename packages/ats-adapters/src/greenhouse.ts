import { fetch } from 'undici'
import { USER_AGENT, AtsHttpError, AtsParseError } from './errors'
import type { RawGreenhouseJob, GreenhouseResponse } from './raw-types'

const BASE_URL = 'https://boards-api.greenhouse.io/v1/boards'

/**
 * Fetch all active job postings for a Greenhouse board.
 *
 * @param token - The Greenhouse board slug (e.g. "stripe")
 * @returns Array of raw Greenhouse job objects (typed, unnormalized)
 *
 * Rate limit: ~60 req/min per IP (enforced by worker rate limiter in Phase 3)
 * Pagination: none — a single request returns all jobs
 */
export async function fetchGreenhouseJobs(
  token: string,
): Promise<RawGreenhouseJob[]> {
  const url = `${BASE_URL}/${encodeURIComponent(token)}/jobs?content=true`

  let res: Awaited<ReturnType<typeof fetch>>
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    })
  } catch (err) {
    throw new AtsHttpError('greenhouse', 0, token)
  }

  if (!res.ok) {
    throw new AtsHttpError('greenhouse', res.status, token)
  }

  let data: unknown
  try {
    data = await res.json()
  } catch (err) {
    throw new AtsParseError('greenhouse', token, err)
  }

  const response = data as GreenhouseResponse
  return response.jobs ?? []
}

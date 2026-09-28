import { fetch } from 'undici'
import { USER_AGENT, AtsHttpError, AtsParseError } from './errors'
import type { RawAshbyJob, AshbyResponse } from './raw-types'

const BASE_URL = 'https://api.ashbyhq.com/posting-api/job-board'

/**
 * Fetch all active job postings for an Ashby job board.
 *
 * @param token - The Ashby board slug (e.g. "linear", "openai")
 * @returns Array of raw Ashby job objects (typed, unnormalized)
 *
 * Rate limit: ~60 req/min (enforced by worker rate limiter in Phase 3)
 * Pagination: none — single call returns all postings
 * Native fields: isRemote, employmentType, compensationTierSummary
 */
export async function fetchAshbyJobs(token: string): Promise<RawAshbyJob[]> {
  const url = `${BASE_URL}/${encodeURIComponent(token)}`

  let res: Awaited<ReturnType<typeof fetch>>
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    })
  } catch (err) {
    throw new AtsHttpError('ashby', 0, token)
  }

  if (!res.ok) {
    throw new AtsHttpError('ashby', res.status, token)
  }

  let data: unknown
  try {
    data = await res.json()
  } catch (err) {
    throw new AtsParseError('ashby', token, err)
  }

  const response = data as AshbyResponse
  // API v2+ uses "jobs"; older boards use "jobPostings"
  return response.jobs ?? response.jobPostings ?? []
}

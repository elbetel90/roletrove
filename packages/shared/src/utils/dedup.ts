import { createHash } from 'crypto'
import type { JobHashes } from '../types'

interface DedupeInput {
  company_slug: string
  title_normalized: string
  location_bucket: string  // e.g. "remote-us", "onsite-gb", "unknown"
  role_family: string
  department: string | null
}

/**
 * Compute two dedup hashes for a job record.
 *
 * - exact_hash: content fingerprint (company + normalized title + location bucket)
 * - role_family_hash: identifies a "role" for cross-posting dedup (company + family + department)
 */
export function computeHashes(params: DedupeInput): JobHashes {
  const exact_hash = createHash('sha256')
    .update(
      `${params.company_slug}::${params.title_normalized}::${params.location_bucket}`,
    )
    .digest('hex')

  const role_family_hash = createHash('sha256')
    .update(
      `${params.company_slug}::${params.role_family}::${params.department ?? ''}`,
    )
    .digest('hex')

  return { exact_hash, role_family_hash }
}

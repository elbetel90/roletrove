import type { Seniority } from '../types'
import { SENIORITY_RULES } from '../constants/seniority-rules'

/**
 * Extract seniority level from a job title.
 * Returns 'unknown' if no rule matches.
 */
export function extractSeniority(title: string): Seniority {
  for (const rule of SENIORITY_RULES) {
    if (rule.pattern.test(title)) {
      return rule.level
    }
  }
  return 'unknown'
}

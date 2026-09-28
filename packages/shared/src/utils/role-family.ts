import type { RoleFamily } from '../types'
import { ROLE_FAMILY_RULES } from '../constants/role-families'

/**
 * Extract role family from a job title.
 * Returns 'other' if no rule matches.
 */
export function extractRoleFamily(title: string): RoleFamily {
  for (const rule of ROLE_FAMILY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(title)) {
        return rule.family
      }
    }
  }
  return 'other'
}

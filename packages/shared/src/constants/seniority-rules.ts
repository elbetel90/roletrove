import type { Seniority } from '../types'

// Priority-ordered seniority extraction rules.
// First match wins. Applied against the full job title.
export const SENIORITY_RULES: Array<{ pattern: RegExp; level: Seniority }> = [
  {
    pattern: /\b(staff|principal|distinguished|fellow|architect)\b/i,
    level: 'staff',
  },
  {
    pattern: /\b(senior|sr\.?|lead|tech\s*lead|l5|l6|ic5|ic6|e5|e6|p5|p6)\b/i,
    level: 'senior',
  },
  {
    pattern: /\b(mid[\s-]?level|mid|ii|iii|2|3|l4|ic4|e4|intermediate)\b/i,
    level: 'mid',
  },
  {
    pattern: /\b(junior|jr\.?|entry[\s-]?level|associate|l3|ic3|e3|i|1)\b/i,
    level: 'junior',
  },
  {
    pattern: /\b(intern|internship|co[\s-]?op|apprentice|trainee)\b/i,
    level: 'intern',
  },
]

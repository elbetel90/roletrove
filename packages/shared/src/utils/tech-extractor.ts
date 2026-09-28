import {
  ALL_KEYWORDS,
  STRICT_BOUNDARY_KEYWORDS,
} from '../constants/tech-keywords'

/**
 * Extract tech stack keywords from a job description text.
 *
 * - Multi-word terms (e.g. "next.js") are matched as-is via includes()
 * - Single-word short terms in STRICT_BOUNDARY_KEYWORDS use \b word-boundary regex
 * - Returns deduplicated, sorted array
 */
export function extractTechStack(descriptionText: string): string[] {
  const lower = descriptionText.toLowerCase()
  const found = new Set<string>()

  for (const keyword of ALL_KEYWORDS) {
    if (STRICT_BOUNDARY_KEYWORDS.has(keyword)) {
      // Word-boundary match to avoid false positives (e.g. "go" in "cargo")
      const pattern = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i')
      if (pattern.test(lower)) {
        found.add(keyword)
      }
    } else if (keyword.includes(' ') || keyword.includes('.')) {
      // Multi-word or dotted term — simple includes()
      if (lower.includes(keyword)) {
        found.add(keyword)
      }
    } else {
      // Standard term — word-boundary match for safety
      const pattern = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i')
      if (pattern.test(lower)) {
        found.add(keyword)
      }
    }
  }

  return [...found].sort()
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

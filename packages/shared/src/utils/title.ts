const ABBREVIATIONS: Record<string, string> = {
  'sr.': 'senior',
  'sr': 'senior',
  'jr.': 'junior',
  'jr': 'junior',
  'eng.': 'engineer',
  'mgr.': 'manager',
  'mgr': 'manager',
  'dir.': 'director',
  'dir': 'director',
  'vp': 'vice president',
}

/**
 * Normalize a job title for dedup hashing and search.
 * - Lowercases
 * - Strips punctuation (except hyphens between words)
 * - Collapses whitespace
 * - Expands common abbreviations
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')   // strip punctuation, keep hyphens
    .replace(/\s+/g, ' ')        // collapse whitespace
    .trim()
    .split(' ')
    .map((word) => ABBREVIATIONS[word] ?? word)
    .join(' ')
}

/**
 * Strip HTML entities from a string (simple pass for descriptions).
 */
export function stripHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * Strip all HTML tags, decode entities, collapse whitespace.
 * Used to produce description_text from description_html.
 */
export function htmlToText(html: string): string {
  return stripHtmlEntities(html)
    .replace(/<[^>]+>/g, ' ')   // remove tags
    .replace(/\s+/g, ' ')       // collapse whitespace
    .trim()
}

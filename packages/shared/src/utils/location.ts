import type { ParsedLocation, LocationType } from '../types'

// Country name / city → ISO 3166-1 alpha-2 code
const COUNTRY_MAP: Record<string, string> = {
  'united states': 'US',
  'usa': 'US',
  'us': 'US',
  'u.s.': 'US',
  'u.s.a.': 'US',
  'san francisco': 'US',
  'new york': 'US',
  'new york city': 'US',
  'nyc': 'US',
  'seattle': 'US',
  'boston': 'US',
  'austin': 'US',
  'chicago': 'US',
  'los angeles': 'US',
  'la': 'US',
  'denver': 'US',
  'atlanta': 'US',
  'united kingdom': 'GB',
  'uk': 'GB',
  'london': 'GB',
  'england': 'GB',
  'canada': 'CA',
  'toronto': 'CA',
  'vancouver': 'CA',
  'montreal': 'CA',
  'germany': 'DE',
  'berlin': 'DE',
  'munich': 'DE',
  'france': 'FR',
  'paris': 'FR',
  'netherlands': 'NL',
  'amsterdam': 'NL',
  'spain': 'ES',
  'madrid': 'ES',
  'barcelona': 'ES',
  'sweden': 'SE',
  'stockholm': 'SE',
  'india': 'IN',
  'bangalore': 'IN',
  'bengaluru': 'IN',
  'hyderabad': 'IN',
  'mumbai': 'IN',
  'singapore': 'SG',
  'australia': 'AU',
  'sydney': 'AU',
  'melbourne': 'AU',
  'israel': 'IL',
  'tel aviv': 'IL',
  'brazil': 'BR',
  'são paulo': 'BR',
  'sao paulo': 'BR',
  'japan': 'JP',
  'tokyo': 'JP',
}

// Timezone hints in job descriptions
const TIMEZONE_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /\bus\s*(timezones?|only|based)\b/i, hint: 'US timezones' },
  { pattern: /\b(pst|pdt|pacific)\b/i, hint: 'PT' },
  { pattern: /\b(est|edt|eastern)\b/i, hint: 'ET' },
  { pattern: /\b(cst|cdt|central)\b/i, hint: 'CT' },
  { pattern: /\b(mst|mdt|mountain)\b/i, hint: 'MT' },
  { pattern: /\b(gmt|bst|uk\s*time)\b/i, hint: 'GMT/BST' },
  { pattern: /\bcet\b/i, hint: 'CET' },
  { pattern: /\best\s*to\s*pst\b/i, hint: 'US timezones' },
  { pattern: /\bapac\b/i, hint: 'APAC' },
  { pattern: /\bemea\b/i, hint: 'EMEA' },
]

function detectLocationType(lower: string): LocationType {
  if (/\bremote\b/.test(lower)) return 'remote'
  if (/\bhybrid\b/.test(lower)) return 'hybrid'
  if (/\bonsite\b|\bon[\s-]?site\b|\bin[\s-]?office\b/.test(lower)) return 'onsite'
  if (lower.trim().length === 0) return 'unknown'
  // Has a city/country name → assume onsite
  return 'onsite'
}

function extractCountry(lower: string): string | null {
  for (const [term, code] of Object.entries(COUNTRY_MAP)) {
    if (lower.includes(term)) return code
  }
  return null
}

function extractTimezoneHint(lower: string): string | null {
  for (const { pattern, hint } of TIMEZONE_PATTERNS) {
    if (pattern.test(lower)) return hint
  }
  return null
}

/**
 * Parse a raw location string from an ATS into a structured ParsedLocation.
 */
export function parseLocation(raw: string | null | undefined): ParsedLocation {
  if (!raw || raw.trim().length === 0) {
    return { raw: '', type: 'unknown', country: null, region: null, timezone_hint: null }
  }

  const lower = raw.toLowerCase()

  return {
    raw,
    type: detectLocationType(lower),
    country: extractCountry(lower),
    region: null, // populated later if needed
    timezone_hint: extractTimezoneHint(lower),
  }
}

/**
 * Build a location bucket string for dedup hashing.
 * Reduces granular location to a coarse bucket.
 */
export function toLocationBucket(location: ParsedLocation): string {
  if (location.type === 'remote') {
    return location.country ? `remote-${location.country.toLowerCase()}` : 'remote'
  }
  if (location.type === 'hybrid') {
    return location.country ? `hybrid-${location.country.toLowerCase()}` : 'hybrid'
  }
  if (location.country) {
    return `onsite-${location.country.toLowerCase()}`
  }
  return 'unknown'
}

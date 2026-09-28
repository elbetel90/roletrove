export interface ParsedCompensation {
  comp_min: number | null
  comp_max: number | null
  comp_currency: string | null
  has_equity: boolean
}

// ─── Currency detection ───────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Array<{ symbol: string; code: string }> = [
  { symbol: '€', code: 'EUR' },
  { symbol: '£', code: 'GBP' },
  { symbol: '¥', code: 'JPY' },
  { symbol: 'A\\$', code: 'AUD' },
  { symbol: 'C\\$', code: 'CAD' },
  { symbol: '\\$', code: 'USD' }, // last — USD $ is a catch-all
]

const ISO_CURRENCY_PATTERN =
  /\b(USD|EUR|GBP|CAD|AUD|JPY|CHF|INR|SGD|NZD|BRL|MXN|ILS)\b/i

function detectCurrency(text: string): string | null {
  for (const { symbol, code } of CURRENCY_SYMBOLS) {
    const re = new RegExp(symbol)
    if (re.test(text)) return code
  }
  const iso = text.match(ISO_CURRENCY_PATTERN)
  if (iso) return iso[1].toUpperCase()
  return null
}

// ─── Number parsing ───────────────────────────────────────────────────────────

/**
 * Parse a salary token like "150,000", "150K", "150k", "1.5M" → number
 */
function parseAmount(raw: string): number | null {
  const clean = raw.replace(/,/g, '').trim()

  const kMatch = clean.match(/^([\d.]+)\s*[kK]$/)
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000)

  const mMatch = clean.match(/^([\d.]+)\s*[mM]$/)
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1_000_000)

  const plain = parseFloat(clean)
  if (!isNaN(plain) && plain > 0) {
    const val = Math.round(plain)
    // Cap at 2M to avoid INT4 overflow and filter out nonsense matches
    return val <= 2_000_000 ? val : null
  }

  return null
}

// ─── Salary range patterns ────────────────────────────────────────────────────

// Matches: $150K – $200K | $150,000 - $200,000 | €80k–€100k | 150000 to 200000 USD
// NOTE: Requires at least one side to have a currency symbol, K/M suffix, OR value >= 1000
// to avoid matching "2-3 days per week", "5-10%", etc.
const RANGE_PATTERN =
  /(?:[€£¥$]|[A-Z]{3}\s*)?[\s]*([\d,.]+\s*[kKmM]?)(?:\s*[-–—to]+\s*)(?:[€£¥$]|[A-Z]{3}\s*)?([\d,.]+\s*[kKmM]?)/g

// Matches a single value: $150K/year | £60,000 per annum
const SINGLE_PATTERN =
  /(?:[€£¥$])([\d,.]+\s*[kKmM]?)\s*(?:\/\s*(?:yr|year|annum|annually))?/gi

// ─── Equity detection ─────────────────────────────────────────────────────────

const EQUITY_PATTERN =
  /\b(equity|stock\s*option|option\s*grant|RSU|restricted\s*stock|vesting|ESOP|warrant)\b/i

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse compensation fields from free-form text (job description or salary summary).
 *
 * Handles:
 *   "$150K – $200K"          → min: 150000, max: 200000, currency: USD
 *   "$150,000 - $200,000"    → min: 150000, max: 200000, currency: USD
 *   "€80k–€100k"             → min: 80000,  max: 100000, currency: EUR
 *   "£60,000"                → min: 60000,  max: null,   currency: GBP
 *   "150000-200000 USD"      → min: 150000, max: 200000, currency: USD
 *   "Up to $120K"            → min: null,   max: 120000, currency: USD
 */
export function parseCompensation(text: string): ParsedCompensation {
  if (!text || text.trim().length === 0) {
    return { comp_min: null, comp_max: null, comp_currency: null, has_equity: false }
  }

  const currency = detectCurrency(text)
  const has_equity = EQUITY_PATTERN.test(text)

  // Normalize "/yr", "/year", "/annum" suffixes so "$223,000/yr to $278,000/yr"
  // becomes "$223,000 to $278,000", which the range pattern can handle cleanly.
  text = text.replace(/\/(yr|year|annum|annually|mo|month)\b/gi, '')

  // Try range match first (most common in structured summary strings).
  // Loop through ALL matches and take the first one where at least one value
  // looks like a salary (>= 1000). This prevents false matches on
  // "2-3 days per week", "5-10%", page numbers, etc.
  RANGE_PATTERN.lastIndex = 0
  let rangeMatch: RegExpExecArray | null
  while ((rangeMatch = RANGE_PATTERN.exec(text)) !== null) {
    const min = parseAmount(rangeMatch[1])
    const max = parseAmount(rangeMatch[2])
    const looksLikeSalary =
      (min !== null && min >= 1_000) || (max !== null && max >= 1_000)
    if (looksLikeSalary) {
      return {
        comp_min: min,
        comp_max: max,
        comp_currency: currency,
        has_equity,
      }
    }
  }

  // Try "Up to $X" pattern
  const upToMatch = text.match(
    /up\s+to\s+(?:[€£¥$])?([\d,.]+\s*[kKmM]?)/i,
  )
  if (upToMatch) {
    const max = parseAmount(upToMatch[1])
    return { comp_min: null, comp_max: max, comp_currency: currency, has_equity }
  }

  // Try single value
  SINGLE_PATTERN.lastIndex = 0
  const singleMatch = SINGLE_PATTERN.exec(text)
  if (singleMatch) {
    const val = parseAmount(singleMatch[1])
    // Heuristic: if value looks like an annual salary (>= 20k), treat as min
    if (val !== null && val >= 20_000) {
      return { comp_min: val, comp_max: null, comp_currency: currency, has_equity }
    }
  }

  return { comp_min: null, comp_max: null, comp_currency: currency, has_equity }
}

/**
 * Parse Lever's native salaryRange object if present.
 */
export function parseLeverSalaryRange(range: {
  min: number | null
  max: number | null
  currency: string | null
  interval: string | null
} | undefined): Pick<ParsedCompensation, 'comp_min' | 'comp_max' | 'comp_currency'> {
  if (!range) return { comp_min: null, comp_max: null, comp_currency: null }

  // Lever can express monthly — convert to annual
  const factor = range.interval === 'per-month' ? 12 : 1

  return {
    comp_min: range.min !== null ? Math.round(range.min * factor) : null,
    comp_max: range.max !== null ? Math.round(range.max * factor) : null,
    comp_currency: range.currency?.toUpperCase() ?? null,
  }
}

/**
 * ATS Detector — given a company career page URL or domain, determine which
 * ATS platform it uses via:
 *   1. Redirect chain: follow HTTP 301/302/307/308 to known ATS hostnames
 *   2. HTML fingerprints: scan page source for ATS-specific scripts / meta tags
 *   3. DNS CNAME: Workday tenants resolve *.myworkdayjobs.com CNAMEs
 *
 * This utility is used when adding new companies to the seed (Phase 3+).
 */

import { fetch } from 'undici'
import dns from 'dns/promises'
import type { AtsType } from '@roletrove/shared'
import { USER_AGENT } from '@roletrove/ats-adapters'
import { logger } from './logger'

// ─── Redirect chain matchers ──────────────────────────────────────────────────

const REDIRECT_PATTERNS: Array<{ pattern: RegExp; ats: AtsType; tokenGroup: number }> = [
  {
    // https://boards.greenhouse.io/{slug} or https://job-boards.greenhouse.io/{slug}
    pattern: /(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)/,
    ats: 'greenhouse',
    tokenGroup: 1,
  },
  {
    // https://jobs.lever.co/{slug}
    pattern: /jobs\.lever\.co\/([^/?#]+)/,
    ats: 'lever',
    tokenGroup: 1,
  },
  {
    // https://jobs.ashbyhq.com/{slug} or https://app.ashbyhq.com/jobs/{slug}
    pattern: /(?:jobs|app)\.ashbyhq\.com\/(?:jobs\/)?([^/?#]+)/,
    ats: 'ashby',
    tokenGroup: 1,
  },
  {
    // https://{slug}.workable.com or https://apply.workable.com/{slug}
    pattern: /(?:([a-z0-9-]+)\.workable\.com|apply\.workable\.com\/([a-z0-9-]+))/,
    ats: 'workable',
    tokenGroup: 1,
  },
  {
    // https://{slug}.myworkdayjobs.com/...
    pattern: /([a-z0-9-]+)\.(?:wd\d+|myworkday)jobs\.com/,
    ats: 'workday',
    tokenGroup: 1,
  },
  {
    // https://careers.smartrecruiters.com/{slug} or SmartRecruiters embed
    pattern: /(?:careers\.smartrecruiters\.com|jobs\.smartrecruiters\.com)\/([^/?#]+)/,
    ats: 'smartrecruiters',
    tokenGroup: 1,
  },
]

// ─── HTML fingerprints ────────────────────────────────────────────────────────

const HTML_FINGERPRINTS: Array<{ pattern: RegExp; ats: AtsType }> = [
  { pattern: /greenhouse\.io\/js\/embed\.js/i,          ats: 'greenhouse' },
  { pattern: /boards\.greenhouse\.io/i,                 ats: 'greenhouse' },
  { pattern: /ashbyhq\.com\/job-board-embed/i,          ats: 'ashby' },
  { pattern: /jobs\.ashbyhq\.com/i,                     ats: 'ashby' },
  { pattern: /lever\.co\/.*embed/i,                     ats: 'lever' },
  { pattern: /jobs\.lever\.co/i,                        ats: 'lever' },
  { pattern: /workable\.com\/embed/i,                   ats: 'workable' },
  { pattern: /apply\.workable\.com/i,                   ats: 'workable' },
  { pattern: /myworkdayjobs\.com/i,                     ats: 'workday' },
  { pattern: /smartrecruiters\.com/i,                   ats: 'smartrecruiters' },
  { pattern: /icims\.com/i,                             ats: 'icims' },
  { pattern: /successfactors\.(eu|com)/i,               ats: 'successfactors' },
  { pattern: /taleo\.net/i,                             ats: 'taleo' },
]

// ─── DNS CNAME check (Workday) ────────────────────────────────────────────────

async function checkWorkdayCname(hostname: string): Promise<string | null> {
  try {
    const cnames = await dns.resolveCname(hostname)
    for (const cname of cnames) {
      if (/myworkdayjobs\.com/.test(cname)) {
        const match = cname.match(/([a-z0-9-]+)\.(?:wd\d+|myworkday)jobs\.com/)
        return match?.[1] ?? null
      }
    }
  } catch {
    // DNS failure is expected for non-Workday hostnames
  }
  return null
}

// ─── Main detection function ──────────────────────────────────────────────────

export interface AtsDetectionResult {
  ats: AtsType
  token: string | null   // ATS board slug/token, if detectable
  confidence: 'high' | 'medium' | 'low'
  method: 'redirect' | 'html_fingerprint' | 'dns_cname' | 'none'
}

/**
 * Detect the ATS used by a company's careers page.
 *
 * @param url - The company's careers URL (e.g. "https://stripe.com/jobs")
 *              or bare domain (e.g. "stripe.com")
 * @param timeoutMs - HTTP fetch timeout in milliseconds (default 10s)
 */
export async function detectAts(
  url: string,
  timeoutMs = 10_000,
): Promise<AtsDetectionResult> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}/careers`

  // ── 1. Follow redirect chain ────────────────────────────────────────────────
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const res = await fetch(normalizedUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal as any,
      headers: { 'User-Agent': USER_AGENT },
    })

    clearTimeout(timeout)

    const finalUrl = res.url

    // Check the final URL (after all redirects) against known ATS patterns
    for (const { pattern, ats, tokenGroup } of REDIRECT_PATTERNS) {
      const m = finalUrl.match(pattern)
      if (m) {
        return {
          ats,
          token: m[tokenGroup] ?? m[tokenGroup + 1] ?? null,
          confidence: 'high',
          method: 'redirect',
        }
      }
    }

    // ── 2. HTML fingerprints (scan page body) ─────────────────────────────────
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('text/html') && res.body) {
      // Read up to 64KB — enough to find scripts in <head>
      const body = await res.text()
      const sample = body.slice(0, 65_536)

      for (const { pattern, ats } of HTML_FINGERPRINTS) {
        if (pattern.test(sample)) {
          // Try to extract token from embedded URL
          let token: string | null = null
          for (const rp of REDIRECT_PATTERNS.filter((r) => r.ats === ats)) {
            const m = sample.match(rp.pattern)
            if (m) {
              token = m[rp.tokenGroup] ?? m[rp.tokenGroup + 1] ?? null
              break
            }
          }
          return {
            ats,
            token,
            confidence: 'medium',
            method: 'html_fingerprint',
          }
        }
      }
    }
  } catch (err) {
    logger.debug({ url: normalizedUrl, err: String(err) }, 'ATS detect: HTTP fetch failed')
  }

  // ── 3. DNS CNAME check (Workday) ───────────────────────────────────────────
  try {
    const hostname = new URL(normalizedUrl).hostname
    const workdayToken = await checkWorkdayCname(hostname)
    if (workdayToken) {
      return {
        ats: 'workday',
        token: workdayToken,
        confidence: 'high',
        method: 'dns_cname',
      }
    }
  } catch {
    // URL parse failure or DNS error
  }

  return { ats: 'unknown', token: null, confidence: 'low', method: 'none' }
}

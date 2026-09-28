import type { Redis } from 'ioredis'
import { rateLimitWaits } from './metrics'

// ─── Per-domain token bucket config ──────────────────────────────────────────

interface BucketConfig {
  /** Maximum sustained requests per minute */
  rpm: number
  /** Burst capacity (tokens above sustained rate that can be consumed instantly) */
  burst: number
}

const DOMAIN_CONFIGS: Record<string, BucketConfig> = {
  'boards-api.greenhouse.io': { rpm: 60, burst: 10 },
  'api.ashbyhq.com':          { rpm: 60, burst: 10 },
  'api.lever.co':             { rpm: 120, burst: 20 },
  'apply.workable.com':       { rpm: 30, burst: 5 },
  'api.smartrecruiters.com':  { rpm: 60, burst: 10 },
}

const DEFAULT_CONFIG: BucketConfig = { rpm: 30, burst: 5 }

// ─── Atomic Lua script ────────────────────────────────────────────────────────
// Returns [allowed: 0|1, wait_ms: number]
// allowed=1: token consumed, proceed
// allowed=0: bucket empty, caller should wait wait_ms before retrying

const TOKEN_BUCKET_SCRIPT = `
local key        = KEYS[1]
local now        = tonumber(ARGV[1])   -- epoch ms
local rate_per_s = tonumber(ARGV[2])   -- tokens per second (rpm / 60)
local burst      = tonumber(ARGV[3])   -- max bucket size

local data = redis.call('HMGET', key, 'tokens', 'last_ms')
local tokens   = tonumber(data[1])
local last_ms  = tonumber(data[2])

if tokens == nil or last_ms == nil then
  tokens  = burst
  last_ms = now
end

-- Refill based on elapsed time
local elapsed_s = math.max(0, (now - last_ms) / 1000)
tokens = math.min(burst, tokens + elapsed_s * rate_per_s)

if tokens < 1 then
  -- Not enough — calculate wait until 1 token is available
  local wait_s = (1 - tokens) / rate_per_s
  local wait_ms = math.ceil(wait_s * 1000)
  redis.call('HMSET', key, 'tokens', tokens, 'last_ms', now)
  redis.call('EXPIRE', key, 600)
  return {0, wait_ms}
else
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'last_ms', now)
  redis.call('EXPIRE', key, 600)
  return {1, 0}
end
`

// ─── RateLimiter class ────────────────────────────────────────────────────────

export class RateLimiter {
  private readonly redis: Redis

  constructor(redis: Redis) {
    this.redis = redis
    // Pre-load the script SHA (fire-and-forget on construction)
    this.redis.script('LOAD', TOKEN_BUCKET_SCRIPT).catch(() => {
      // Will fall back to EVAL on first use if EVALSHA fails
    })
  }

  /**
   * Consume one token for the given domain.
   *
   * If the bucket is empty, waits the required milliseconds and retries.
   * This provides transparent backpressure without throwing.
   *
   * @returns Milliseconds waited (0 if token was available immediately)
   */
  async consume(domain: string): Promise<number> {
    const cfg = DOMAIN_CONFIGS[domain] ?? DEFAULT_CONFIG
    const ratePerSec = cfg.rpm / 60

    const key = `rate:${domain}`
    const now = Date.now()

    const [allowed, waitMs] = await this.redis.eval(
      TOKEN_BUCKET_SCRIPT,
      1,
      key,
      now,
      ratePerSec,
      cfg.burst,
    ) as [number, number]

    if (allowed === 1) return 0

    // Token unavailable — wait then retry recursively
    rateLimitWaits.inc({ domain })
    await sleep(waitMs)
    return waitMs + (await this.consume(domain))
  }

  /**
   * Check if a token is available without consuming it.
   * Useful for monitoring but not for actual rate limiting.
   */
  async peek(domain: string): Promise<{ tokens: number; rpm: number }> {
    const cfg = DOMAIN_CONFIGS[domain] ?? DEFAULT_CONFIG
    const key = `rate:${domain}`
    const [tokensStr] = await this.redis.hmget(key, 'tokens')
    return {
      tokens: parseFloat(tokensStr ?? String(cfg.burst)),
      rpm: cfg.rpm,
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Domain lookup helpers ────────────────────────────────────────────────────

export const ATS_DOMAINS: Record<string, string> = {
  greenhouse: 'boards-api.greenhouse.io',
  ashby:      'api.ashbyhq.com',
  lever:      'api.lever.co',
  workable:   'apply.workable.com',
  smartrecruiters: 'api.smartrecruiters.com',
}

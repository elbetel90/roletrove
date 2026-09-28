import { Registry, Counter, Histogram, Gauge } from 'prom-client'

export const registry = new Registry()

registry.setDefaultLabels({ app: 'roletrove-worker' })

// ─── Crawl metrics ───────────────────────────────────────────────────────────

export const crawlJobsTotal = new Counter({
  name: 'crawl_jobs_total',
  help: 'Total jobs fetched from ATS APIs',
  labelNames: ['ats_type'],
  registers: [registry],
})

export const crawlDuration = new Histogram({
  name: 'crawl_duration_seconds',
  help: 'Duration of a single company poll in seconds',
  labelNames: ['ats_type', 'company_slug'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [registry],
})

export const crawlErrorsTotal = new Counter({
  name: 'crawl_errors_total',
  help: 'Total crawl errors by ATS type and error type',
  labelNames: ['ats_type', 'error_type'],
  registers: [registry],
})

// ─── Ingestion metrics ───────────────────────────────────────────────────────

export const jobsIngested = new Counter({
  name: 'jobs_ingested_total',
  help: 'Jobs written to the database by state change',
  labelNames: ['ats_type', 'state'], // state: new | updated | unchanged | closed
  registers: [registry],
})

// ─── Queue metrics ────────────────────────────────────────────────────────────

export const queueDepth = new Gauge({
  name: 'queue_depth',
  help: 'Current BullMQ queue depth',
  labelNames: ['queue_name'],
  registers: [registry],
})

export const queueProcessed = new Counter({
  name: 'queue_jobs_processed_total',
  help: 'Total BullMQ jobs processed',
  labelNames: ['queue_name', 'status'], // status: completed | failed
  registers: [registry],
})

// ─── Rate limiter metrics ─────────────────────────────────────────────────────

export const rateLimitWaits = new Counter({
  name: 'rate_limit_waits_total',
  help: 'Number of times a request was delayed by rate limiter',
  labelNames: ['domain'],
  registers: [registry],
})

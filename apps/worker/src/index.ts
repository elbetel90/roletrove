import http from 'http'
import { registry } from './metrics'
import { logger } from './logger'
import { redisClient, closeRedis } from './redis'
import { closeQueues, companyPollQueue, jobNormalizeQueue } from './queues'
import { RateLimiter } from './rate-limiter'
import { createFetchWorker } from './fetch-worker'
import { createNormalizeWorker } from './normalize-worker'
import { startScheduler, stopScheduler } from './scheduler'
import { startR2Drain, stopR2Drain } from './r2-drain'
import { queueDepth } from './metrics'

const METRICS_PORT = parseInt(process.env.METRICS_PORT ?? '9090', 10)
const METRICS_HOST = process.env.METRICS_HOST ?? '127.0.0.1'

// ─── Prometheus metrics HTTP server ──────────────────────────────────────────
// Scraped by Grafana Alloy agent and forwarded to Grafana Cloud.

const metricsServer = http.createServer(async (req, res) => {
  if (req.url === '/metrics' && req.method === 'GET') {
    try {
      const metrics = await registry.metrics()
      res.setHeader('Content-Type', registry.contentType)
      res.writeHead(200)
      res.end(metrics)
    } catch (err) {
      res.writeHead(500).end(String(err))
    }
  } else if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200).end(JSON.stringify({ ok: true }))
  } else {
    res.writeHead(404).end()
  }
})

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // 1. Start metrics server
  await new Promise<void>((resolve) => {
    metricsServer.listen(METRICS_PORT, METRICS_HOST, () => {
      logger.info({ host: METRICS_HOST, port: METRICS_PORT }, 'Metrics server listening')
      resolve()
    })
  })

  // 2. Instantiate rate limiter (shared across fetch workers)
  const rateLimiter = new RateLimiter(redisClient)

  // 3. Start BullMQ workers
  const fetchWorker     = createFetchWorker(rateLimiter)
  const normalizeWorker = createNormalizeWorker()

  logger.info('BullMQ workers started')

  // 4. Start cron scheduler
  startScheduler()

  // 5. Start R2 drain (no-op if R2 env vars missing)
  startR2Drain()

  // 6. Periodic queue depth metrics
  setInterval(async () => {
    try {
      const [pollWaiting, normalizeWaiting] = await Promise.all([
        companyPollQueue.getWaitingCount(),
        jobNormalizeQueue.getWaitingCount(),
      ])
      queueDepth.set({ queue_name: 'company-poll' }, pollWaiting)
      queueDepth.set({ queue_name: 'job-normalize' }, normalizeWaiting)
    } catch {
      // non-critical
    }
  }, 15_000)

  logger.info('Worker process fully started')

  // ─── Graceful shutdown ──────────────────────────────────────────────────────

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Received shutdown signal — shutting down gracefully')

    // 1. Stop scheduler (no new jobs enqueued)
    stopScheduler()

    // 2. Stop R2 drain
    stopR2Drain()

    // 3. Close BullMQ workers (wait for current jobs to finish)
    await Promise.allSettled([
      fetchWorker.close(),
      normalizeWorker.close(),
    ])

    // 4. Close BullMQ queues
    await closeQueues()

    // 5. Close Redis connections
    await closeRedis()

    // 6. Close metrics server
    await new Promise<void>((resolve) => {
      metricsServer.close(() => {
        logger.info('Metrics server closed')
        resolve()
      })
    })

    logger.info('Shutdown complete')
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT',  () => void shutdown('SIGINT'))
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Worker bootstrap failed')
  process.exit(1)
})

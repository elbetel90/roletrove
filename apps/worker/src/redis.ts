import IORedis from 'ioredis'
import { logger } from './logger'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

function createRedisClient(name: string): IORedis {
  const client = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,    // required by BullMQ
    lazyConnect: false,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000)
      logger.warn({ name, attempt: times, delay_ms: delay }, 'Redis reconnecting')
      return delay
    },
  })

  client.on('connect', () => logger.info({ name }, 'Redis connected'))
  client.on('error', (err) => logger.error({ name, err }, 'Redis error'))
  client.on('close', () => logger.warn({ name }, 'Redis connection closed'))

  return client
}

// BullMQ requires a dedicated connection per queue/worker (cannot share across both)
export const bullConnection = createRedisClient('bullmq')

// Separate connection for rate limiter and other generic use
export const redisClient = createRedisClient('general')

export async function closeRedis(): Promise<void> {
  await Promise.all([
    bullConnection.quit().catch(() => bullConnection.disconnect()),
    redisClient.quit().catch(() => redisClient.disconnect()),
  ])
}

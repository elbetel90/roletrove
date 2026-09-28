/**
 * R2 Drain — background process that uploads description_html blobs to
 * Cloudflare R2 (S3-compatible), then clears the Postgres column to keep the
 * primary DB lean.
 *
 * Activation: only runs when R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are all set in the environment.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@roletrove/db'
import { logger } from './logger'

// ─── Config ───────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50         // jobs per drain iteration
const INTERVAL_MS = 60_000    // run every 60 seconds

function buildS3Client(): S3Client | null {
  const accountId  = process.env.R2_ACCOUNT_ID
  const accessKey  = process.env.R2_ACCESS_KEY_ID
  const secretKey  = process.env.R2_SECRET_ACCESS_KEY
  const bucket     = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKey || !secretKey || !bucket) {
    logger.info(
      'R2 env vars not set — R2 drain disabled (description_html stays in Postgres)',
    )
    return null
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     accessKey,
      secretAccessKey: secretKey,
    },
  })
}

// ─── Drain loop ───────────────────────────────────────────────────────────────

let drainInterval: ReturnType<typeof setInterval> | null = null

export function startR2Drain(): void {
  const s3 = buildS3Client()
  if (!s3) return // disabled

  const bucket = process.env.R2_BUCKET_NAME!

  drainInterval = setInterval(async () => {
    try {
      await drainBatch(s3, bucket)
    } catch (err) {
      logger.error({ err }, 'R2 drain iteration failed')
    }
  }, INTERVAL_MS)

  // Run once immediately on startup
  drainBatch(s3, bucket).catch((err) =>
    logger.error({ err }, 'R2 drain initial run failed'),
  )

  logger.info({ bucket, interval_ms: INTERVAL_MS }, 'R2 drain started')
}

export function stopR2Drain(): void {
  if (drainInterval) {
    clearInterval(drainInterval)
    drainInterval = null
    logger.info('R2 drain stopped')
  }
}

async function drainBatch(s3: S3Client, bucket: string): Promise<void> {
  // Find jobs that have HTML stored in Postgres but not yet uploaded to R2
  const jobs = await prisma.job.findMany({
    where: {
      r2_key:          null,
      description_html: { not: null },
    },
    select: {
      id:               true,
      description_html: true,
      source_ats:       true,
      company_id:       true,
    },
    take: BATCH_SIZE,
  })

  if (jobs.length === 0) return

  logger.debug({ count: jobs.length }, 'R2 drain: uploading batch')

  let uploaded = 0

  await Promise.all(
    jobs.map(async (job) => {
      const r2Key = `jobs/${job.source_ats}/${job.id}.html`
      const html  = job.description_html!

      try {
        await s3.send(
          new PutObjectCommand({
            Bucket:      bucket,
            Key:         r2Key,
            Body:        html,
            ContentType: 'text/html; charset=utf-8',
            // Immutable objects: job descriptions rarely change at the raw level
            CacheControl: 'public, max-age=86400',
          }),
        )

        // Update DB: set r2_key, clear description_html
        await prisma.job.update({
          where: { id: job.id },
          data: {
            r2_key:           r2Key,
            description_html: null,
          },
        })

        uploaded++
      } catch (err) {
        logger.warn({ job_id: job.id, r2Key, err }, 'R2 upload failed for job')
      }
    }),
  )

  logger.info({ uploaded, attempted: jobs.length }, 'R2 drain batch complete')
}

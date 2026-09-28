import { tsClient } from './client'
import { JOBS_COLLECTION, JOBS_SCHEMA } from './schema'

/**
 * Ensure the jobs collection exists in Typesense.
 * If it doesn't exist, creates it. If it does, this is a no-op.
 *
 * Call this at worker/web startup.
 */
export async function ensureCollection(): Promise<void> {
  try {
    await tsClient.collections(JOBS_COLLECTION).retrieve()
    // Collection already exists
  } catch (err: any) {
    if (err?.httpStatus === 404) {
      await tsClient.collections().create(JOBS_SCHEMA)
      console.log(`[search] Created Typesense collection: ${JOBS_COLLECTION}`)
    } else {
      throw err
    }
  }
}

/**
 * Drop and recreate the jobs collection (for migrations / full reindex).
 * WARNING: destroys all indexed data.
 */
export async function recreateCollection(): Promise<void> {
  try {
    await tsClient.collections(JOBS_COLLECTION).delete()
  } catch {
    // OK if it didn't exist
  }
  await tsClient.collections().create(JOBS_SCHEMA)
  console.log(`[search] Recreated Typesense collection: ${JOBS_COLLECTION}`)
}

/**
 * Initialize the Typesense `jobs` collection.
 *
 * Usage:
 *   pnpm --filter @roletrove/search exec tsx scripts/init-typesense.ts
 *
 * Options:
 *   --recreate   Drop and recreate the collection (wipes all indexed data)
 */

import { ensureCollection, recreateCollection } from '../src/collections'

const recreate = process.argv.includes('--recreate')

async function main(): Promise<void> {
  console.log(`Typesense host: ${process.env.TYPESENSE_HOST ?? 'localhost'}:${process.env.TYPESENSE_PORT ?? '8108'}`)

  if (recreate) {
    console.log('--recreate flag set: dropping and recreating collection...')
    await recreateCollection()
  } else {
    console.log('Ensuring collection exists (no-op if already present)...')
    await ensureCollection()
  }

  console.log('✓ Typesense collection ready')
}

main().catch((err) => {
  console.error('✗ Failed to initialize Typesense collection:', err?.message ?? err)
  process.exit(1)
})

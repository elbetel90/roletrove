import TypesenseLib from 'typesense'
import type { Client } from 'typesense'

const TS_HOST    = process.env.TYPESENSE_HOST     ?? 'localhost'
const TS_PORT    = parseInt(process.env.TYPESENSE_PORT ?? '8108', 10)
const TS_PROTO   = (process.env.TYPESENSE_PROTOCOL ?? 'http') as 'http' | 'https'
const TS_API_KEY = process.env.TYPESENSE_API_KEY  ?? 'devtskey'

// Singleton client — safe to import from multiple places
const globalForTs = globalThis as unknown as { tsClient: Client }

export const tsClient: Client =
  globalForTs.tsClient ??
  new TypesenseLib.Client({
    nodes: [{ host: TS_HOST, port: TS_PORT, protocol: TS_PROTO }],
    apiKey: TS_API_KEY,
    connectionTimeoutSeconds: 10,
    retryIntervalSeconds: 0.1,
    numRetries: 3,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForTs.tsClient = tsClient
}

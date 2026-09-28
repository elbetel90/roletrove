import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@roletrove/db'

export interface AuthedContext {
  api_key_id: string
  user_id: string
}

/**
 * Validate a Bearer API key from the Authorization header.
 *
 * Keys are stored as SHA-256 hashes in the ApiKey table.
 * Returns `null` on auth failure (caller should return 401).
 */
export async function validateApiKey(
  req: NextRequest,
): Promise<AuthedContext | null> {
  const authHeader = req.headers.get('authorization') ?? ''

  if (!authHeader.startsWith('Bearer ')) return null

  const rawKey = authHeader.slice(7).trim()
  if (!rawKey) return null

  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const apiKey = await prisma.apiKey.findUnique({
    where: { key_hash: keyHash },
    select: { id: true, user_id: true, revoked_at: true },
  })

  if (!apiKey || apiKey.revoked_at !== null) return null

  // Async increment request count (non-blocking — fire and forget)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: {
        requests_count: { increment: 1 },
        last_used_at: new Date(),
      },
    })
    .catch(() => {/* non-critical */})

  return { api_key_id: apiKey.id, user_id: apiKey.user_id }
}

/**
 * Higher-order wrapper: protect a route handler with API key auth.
 *
 * Usage:
 *   export const GET = withApiKey(async (req, ctx, auth) => { ... })
 */
export function withApiKey<T extends Record<string, string>>(
  handler: (
    req: NextRequest,
    ctx: { params: T },
    auth: AuthedContext,
  ) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ctx: { params: T }): Promise<NextResponse> => {
    const auth = await validateApiKey(req)
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid Bearer API key required' },
        { status: 401 },
      )
    }
    return handler(req, ctx, auth)
  }
}

/**
 * Standard JSON error responses
 */
export const ApiError = {
  unauthorized: () =>
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  notFound: (msg = 'Not found') =>
    NextResponse.json({ error: 'Not Found', message: msg }, { status: 404 }),
  badRequest: (msg: string) =>
    NextResponse.json({ error: 'Bad Request', message: msg }, { status: 400 }),
  internal: (msg = 'Internal server error') =>
    NextResponse.json({ error: 'Internal Server Error', message: msg }, { status: 500 }),
}

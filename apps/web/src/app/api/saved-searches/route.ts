import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@roletrove/db'

// GET /api/saved-searches — list the current user's saved searches
export async function GET(): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searches = await prisma.savedSearch.findMany({
    where: { user_id: session.user.id },
    orderBy: { created_at: 'desc' },
    include: {
      _count: { select: { alerts: true } },
    },
  })

  return NextResponse.json({ data: searches })
}

// POST /api/saved-searches — create a new saved search
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, filters, notify_email = true, notify_frequency = 'daily' } = body as any

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!filters || typeof filters !== 'object') {
    return NextResponse.json({ error: 'filters is required' }, { status: 400 })
  }

  const search = await prisma.savedSearch.create({
    data: {
      user_id:          session.user.id,
      name:             name.trim(),
      filters,
      notify_email:     Boolean(notify_email),
      notify_frequency: ['daily', 'instant'].includes(notify_frequency)
        ? notify_frequency
        : 'daily',
    },
  })

  return NextResponse.json({ data: search }, { status: 201 })
}

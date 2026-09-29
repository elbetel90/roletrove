import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@roletrove/db'

// DELETE /api/saved-searches/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const search = await prisma.savedSearch.findUnique({
    where: { id: params.id },
    select: { user_id: true },
  })

  if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only the owner can delete
  if (search.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.savedSearch.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}

// PATCH /api/saved-searches/[id] — update name / notify settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: headers() })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const search = await prisma.savedSearch.findUnique({
    where: { id: params.id },
    select: { user_id: true },
  })

  if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (search.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as any

  const updated = await prisma.savedSearch.update({
    where: { id: params.id },
    data: {
      ...(body.name             !== undefined && { name: String(body.name).trim() }),
      ...(body.notify_email     !== undefined && { notify_email: Boolean(body.notify_email) }),
      ...(body.notify_frequency !== undefined && {
        notify_frequency: ['daily', 'instant'].includes(body.notify_frequency)
          ? body.notify_frequency
          : 'daily',
      }),
    },
  })

  return NextResponse.json({ data: updated })
}

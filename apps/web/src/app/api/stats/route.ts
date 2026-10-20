import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/dashboard-stats'
import { requireSession } from '@/lib/require-session'

export const runtime = 'nodejs'

/**
 * GET /api/stats
 *
 * Aggregate stats for the dashboard. Requires a signed-in session.
 * The public homepage loads the same data server-side via getDashboardStats().
 */
export async function GET(): Promise<NextResponse> {
  const { error } = await requireSession()
  if (error) return error

  const stats = await getDashboardStats()

  return NextResponse.json(stats, {
    headers: {
      'Cache-Control': 'private, max-age=60',
    },
  })
}

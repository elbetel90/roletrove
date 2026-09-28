import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@roletrove/db'
import { ApiError } from '@/lib/api-auth'

export const runtime = 'nodejs'

/**
 * GET /api/jobs/:id
 *
 * Fetch full job detail from Postgres (includes description_text, all metadata).
 * Typesense stores a subset for search; Postgres is the canonical source for display.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const { id } = params

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      company: {
        select: {
          slug:  true,
          name:  true,
          domain: true,
          ats_type: true,
        },
      },
    },
  })

  if (!job) return ApiError.notFound('Job not found')

  // Don't expose raw HTML in public API response (too large, use source_url)
  const { description_html: _html, ...rest } = job as any

  return NextResponse.json(
    { data: rest },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  )
}

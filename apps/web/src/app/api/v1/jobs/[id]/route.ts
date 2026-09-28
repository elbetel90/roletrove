import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@roletrove/db'
import { withApiKey, ApiError } from '@/lib/api-auth'

export const runtime = 'nodejs'

/**
 * GET /api/v1/jobs/:id
 *
 * Returns full job detail from Postgres.
 * Authentication: Authorization: Bearer <api_key>
 */
export const GET = withApiKey(async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      company: {
        select: { slug: true, name: true, domain: true, ats_type: true },
      },
    },
  })

  if (!job) return ApiError.notFound('Job not found')

  const { description_html: _html, ...rest } = job as any

  return NextResponse.json({ object: 'job', data: rest })
})

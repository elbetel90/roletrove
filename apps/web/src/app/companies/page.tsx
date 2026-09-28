import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@roletrove/db'
import { Badge } from '@/components/ui/badge'
import { ATS_COLORS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Briefcase } from 'lucide-react'

export const metadata: Metadata = { title: 'Companies' }

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { jobs: { where: { status: { in: ['active', 'updated'] } } } },
      },
    },
  })

  const byAts = companies.reduce<Record<string, typeof companies>>((acc, c) => {
    const key = c.ats_type
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const atsSections = Object.entries(byAts).sort(([, a], [, b]) => b.length - a.length)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
        <p className="text-sm text-gray-500 mt-1">
          {companies.length} tracked companies across {atsSections.length} ATS platforms
        </p>
      </div>

      {atsSections.map(([ats, cos]) => (
        <section key={ats}>
          <div className="flex items-center gap-2 mb-4">
            <Badge className={cn('capitalize text-sm px-3 py-1', ATS_COLORS[ats] ?? ATS_COLORS.unknown)}>
              {ats}
            </Badge>
            <span className="text-sm text-gray-400">{cos.length} companies</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {cos.map((company) => (
              <Link
                key={company.id}
                href={`/companies/${company.slug}`}
                className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-md transition-all duration-150"
              >
                {/* Company initial avatar */}
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center mb-3">
                  <span className="text-brand-700 font-bold text-sm">
                    {company.name.charAt(0).toUpperCase()}
                  </span>
                </div>

                <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-brand-600 transition-colors">
                  {company.name}
                </p>

                {company.domain && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{company.domain}</p>
                )}

                <div className="flex items-center gap-1 mt-2">
                  <Briefcase className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    {company._count.jobs.toLocaleString()} open
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

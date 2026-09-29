import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { prisma } from '@roletrove/db'
import { SignOutButton, SavedSearchList } from '@/components/auth/account-client'
import { User } from 'lucide-react'

export const metadata: Metadata = { title: 'Account' }

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: headers() })

  if (!session) {
    redirect('/auth/sign-in')
  }

  const searches = await prisma.savedSearch.findMany({
    where: { user_id: session.user.id },
    orderBy: { created_at: 'desc' },
    include: { _count: { select: { alerts: true } } },
  })

  // Serialize dates to strings for client component
  const serialized = searches.map((s) => ({
    ...s,
    filters:    s.filters as Record<string, unknown>,
    created_at: s.created_at.toISOString(),
    updated_at: s.updated_at.toISOString(),
  }))

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Profile card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center">
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <User className="h-6 w-6 text-brand-600" />
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{session.user.name}</p>
              <p className="text-sm text-gray-500">{session.user.email}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>

      {/* Saved searches */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Saved searches</h2>
          <span className="text-sm text-gray-400">{searches.length} search{searches.length !== 1 ? 'es' : ''}</span>
        </div>
        <SavedSearchList initialSearches={serialized} />
      </div>
    </div>
  )
}

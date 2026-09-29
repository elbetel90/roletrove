'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Trash2, Bell, BellOff } from 'lucide-react'

interface SavedSearch {
  id: string
  name: string
  filters: Record<string, unknown>
  notify_email: boolean
  notify_frequency: string
  created_at: string
  _count: { alerts: number }
}

export function SignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    await signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSignOut} disabled={loading}>
      {loading ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}

export function SavedSearchList({ initialSearches }: { initialSearches: SavedSearch[] }) {
  const [searches, setSearches] = useState(initialSearches)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSearches((prev) => prev.filter((s) => s.id !== id))
      }
    } finally {
      setDeleting(null)
    }
  }

  async function toggleNotify(search: SavedSearch) {
    const res = await fetch(`/api/saved-searches/${search.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notify_email: !search.notify_email }),
    })
    if (res.ok) {
      setSearches((prev) =>
        prev.map((s) => s.id === search.id ? { ...s, notify_email: !s.notify_email } : s),
      )
    }
  }

  if (searches.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
        <p className="text-sm text-gray-500 mb-1">No saved searches yet</p>
        <p className="text-xs text-gray-400">
          Browse jobs and click <strong>Save this search</strong> to get email alerts for new matches.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {searches.map((search) => {
        const filterLabels = Object.entries(search.filters)
          .filter(([, v]) => v !== undefined && v !== '' && v !== null)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)

        return (
          <li
            key={search.id}
            className="flex items-start justify-between gap-4 p-4 bg-white border border-gray-200 rounded-xl"
          >
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm">{search.name}</p>
              {filterLabels.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {filterLabels.join(' · ')}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-gray-400">
                  {search._count.alerts} alert{search._count.alerts !== 1 ? 's' : ''} sent
                </span>
                <span className="text-gray-200">·</span>
                <span className="text-xs text-gray-400 capitalize">{search.notify_frequency}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Toggle email notifications */}
              <button
                onClick={() => toggleNotify(search)}
                title={search.notify_email ? 'Disable email alerts' : 'Enable email alerts'}
                className="p-1.5 rounded-md text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              >
                {search.notify_email
                  ? <Bell className="h-4 w-4" />
                  : <BellOff className="h-4 w-4" />}
              </button>

              {/* Delete */}
              <button
                onClick={() => handleDelete(search.id)}
                disabled={deleting === search.id}
                title="Delete saved search"
                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

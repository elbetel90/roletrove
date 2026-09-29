'use client'

import { useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { Bookmark, BookmarkCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { JobSearchParams } from '@roletrove/search'

interface Props {
  filters: Omit<JobSearchParams, 'page' | 'limit' | 'sort'>
}

export function SaveSearchButton({ filters }: Props) {
  const { data: session } = useSession()
  const [open, setOpen]     = useState(false)
  const [name, setName]     = useState('')
  const [saved, setSaved]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // Don't render for signed-out users (nav already has sign-in CTA)
  if (!session) return null
  if (saved) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg">
        <BookmarkCheck className="h-4 w-4" />
        Search saved
      </span>
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/saved-searches', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          filters,
          notify_email:     true,
          notify_frequency: 'daily',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as any).error ?? 'Could not save search')
        return
      }

      setSaved(true)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  // Check if any non-trivial filters are active
  const hasFilters = Object.values(filters).some((v) => v !== undefined && v !== '' && v !== null)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors"
      >
        <Bookmark className="h-4 w-4" />
        Save search
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          {/* Popover */}
          <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Save this search</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!hasFilters && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-3">
                No filters active — you'll be alerted for all new jobs.
              </p>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Search name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Senior React remote"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}

              <p className="text-xs text-gray-400">
                You'll receive daily email alerts for new matching jobs.
              </p>

              <Button type="submit" size="sm" className="w-full" disabled={loading}>
                {loading ? 'Saving…' : 'Save & enable alerts'}
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}

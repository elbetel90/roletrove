'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useCallback, useRef, useTransition } from 'react'

interface SearchBarProps {
  placeholder?: string
  className?: string
}

export function SearchBar({ placeholder = 'Search jobs…', className }: SearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const q = searchParams.get('q') ?? ''

  const updateSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
          params.set('q', value)
        } else {
          params.delete('q')
        }
        params.delete('page') // reset pagination on new search
        startTransition(() => {
          router.replace(`${pathname}?${params.toString()}`)
        })
      }, 300)
    },
    [router, pathname, searchParams],
  )

  return (
    <div className={`relative ${className}`}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
      />
      <input
        type="search"
        defaultValue={q}
        onChange={(e) => updateSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
        aria-label="Search jobs"
      />
      {isPending && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  )
}

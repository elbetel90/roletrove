'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const SORTS = [
  { value: 'newest',  label: 'Newest' },
  { value: 'updated', label: 'Recently Updated' },
  { value: 'oldest',  label: 'Oldest' },
]

export function SortTabs({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setSort = (sort: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', sort)
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
      {SORTS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setSort(value)}
          className={cn(
            'px-3 py-1 rounded-md text-sm font-medium transition-colors',
            current === value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
}

export function Pagination({ page, totalPages }: PaginationProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  const makeUrl = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    return `${pathname}?${params.toString()}`
  }

  const pages = getPageNumbers(page, totalPages)

  return (
    <nav className="flex items-center justify-center gap-1 mt-8" aria-label="Pagination">
      {page > 1 ? (
        <Link href={makeUrl(page - 1)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className="p-2 text-gray-300">
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">…</span>
        ) : (
          <Link
            key={p}
            href={makeUrl(p as number)}
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors',
              p === page
                ? 'bg-brand-600 text-white'
                : 'text-gray-700 hover:bg-gray-100',
            )}
          >
            {p}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={makeUrl(page + 1)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="p-2 text-gray-300">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  )
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '…')[] = []

  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '…', total)
  } else if (current >= total - 3) {
    pages.push(1, '…', total - 4, total - 3, total - 2, total - 1, total)
  } else {
    pages.push(1, '…', current - 1, current, current + 1, '…', total)
  }

  return pages
}

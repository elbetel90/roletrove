'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Briefcase, Building2, LayoutDashboard, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/',          label: 'Dashboard', icon: LayoutDashboard },
  { href: '/jobs',      label: 'Jobs',      icon: Briefcase       },
  { href: '/companies', label: 'Companies', icon: Building2       },
  { href: '/monitor',   label: 'Monitor',   icon: Activity        },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 shrink-0">
            <span className="text-brand-600 text-lg">⚡</span>
            <span className="text-base tracking-tight">JobsAgg</span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active =
                href === '/' ? pathname === '/' : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto text-xs text-gray-400 hidden sm:block">
            Greenhouse · Ashby · Lever
          </div>
        </div>
      </div>
    </header>
  )
}

'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import type { FacetCount } from '@roletrove/search'
import { cn } from '@/lib/utils'

interface FilterPanelProps {
  facets: {
    seniority:        FacetCount[]
    role_family:      FacetCount[]
    location_type:    FacetCount[]
    location_country: FacetCount[]
    tech_stack:       FacetCount[]
    source_ats:       FacetCount[]
  }
}

export function FilterPanel({ facets }: FilterPanelProps) {
  const router     = useRouter()
  const pathname   = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const getParam = (key: string) => searchParams.get(key) ?? ''

  const toggle = (key: string, value: string) => {
    const current = getParam(key)
    const arr = current ? current.split(',') : []
    const next = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value]
    const params = new URLSearchParams(searchParams.toString())
    if (next.length > 0) {
      params.set(key, next.join(','))
    } else {
      params.delete(key)
    }
    params.delete('page')
    startTransition(() => router.replace(`${pathname}?${params.toString()}`))
  }

  const isActive = (key: string, value: string) =>
    (getParam(key) || '').split(',').includes(value)

  const clearAll = () => {
    startTransition(() => router.replace(pathname))
  }

  const hasFilters = ['seniority', 'role_family', 'location_type', 'source_ats', 'tech_stack'].some(
    (k) => searchParams.get(k),
  )

  return (
    <aside className="w-full space-y-5">
      {hasFilters && (
        <button
          onClick={clearAll}
          className="text-xs text-brand-600 hover:underline font-medium"
        >
          Clear all filters
        </button>
      )}

      <FilterSection
        title="Seniority"
        items={facets.seniority}
        paramKey="seniority"
        isActive={isActive}
        toggle={toggle}
      />

      <FilterSection
        title="Role Family"
        items={facets.role_family}
        paramKey="role_family"
        isActive={isActive}
        toggle={toggle}
        labelMap={ROLE_FAMILY_LABELS}
      />

      <FilterSection
        title="Location"
        items={facets.location_type}
        paramKey="location_type"
        isActive={isActive}
        toggle={toggle}
        labelMap={{ remote: '🌐 Remote', hybrid: '🏠 Hybrid', onsite: '🏢 On-site', unknown: 'Unknown' }}
      />

      <FilterSection
        title="Country"
        items={facets.location_country.slice(0, 8)}
        paramKey="location_country"
        isActive={isActive}
        toggle={toggle}
      />

      <FilterSection
        title="ATS Source"
        items={facets.source_ats}
        paramKey="source_ats"
        isActive={isActive}
        toggle={toggle}
        labelMap={ATS_LABELS}
      />

      {facets.tech_stack.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tech Stack</p>
          <div className="flex flex-wrap gap-1.5">
            {facets.tech_stack.slice(0, 20).map(({ value, count }) => (
              <button
                key={value}
                onClick={() => toggle('tech_stack', value)}
                className={cn(
                  'px-2 py-1 rounded-md text-xs font-mono transition-colors',
                  isActive('tech_stack', value)
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {value} <span className="opacity-60">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

interface FilterSectionProps {
  title: string
  items: FacetCount[]
  paramKey: string
  isActive: (key: string, value: string) => boolean
  toggle: (key: string, value: string) => void
  labelMap?: Record<string, string>
}

function FilterSection({ title, items, paramKey, isActive, toggle, labelMap }: FilterSectionProps) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1">
        {items.slice(0, 10).map(({ value, count }) => {
          const label = labelMap?.[value] ?? value
          const active = isActive(paramKey, value)
          return (
            <button
              key={value}
              onClick={() => toggle(paramKey, value)}
              className={cn(
                'flex items-center justify-between w-full text-left px-2 py-1 rounded-md text-sm transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100',
              )}
            >
              <span className="capitalize truncate">{label}</span>
              <span className={cn('text-xs ml-2 shrink-0', active ? 'text-brand-500' : 'text-gray-400')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const ROLE_FAMILY_LABELS: Record<string, string> = {
  software_engineer: 'Software Engineer',
  frontend:          'Frontend',
  backend:           'Backend',
  fullstack:         'Full Stack',
  mobile:            'Mobile',
  data_engineer:     'Data Engineer',
  ml_engineer:       'ML / AI',
  devops:            'DevOps / Infra',
  security:          'Security',
  product_manager:   'Product Manager',
  designer:          'Designer',
  other:             'Other',
}

const ATS_LABELS: Record<string, string> = {
  greenhouse:      'Greenhouse',
  ashby:           'Ashby',
  lever:           'Lever',
  workable:        'Workable',
  smartrecruiters: 'SmartRecruiters',
  workday:         'Workday',
}

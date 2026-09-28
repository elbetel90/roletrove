import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(date: Date | number | string): string {
  const ms = Date.now() - new Date(date).getTime()
  const s  = Math.floor(ms / 1000)
  const m  = Math.floor(s / 60)
  const h  = Math.floor(m / 60)
  const d  = Math.floor(h / 24)

  if (d > 30) return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

/** Like timeAgo but handles future dates too — shows "in 3h" / "2m overdue" */
export function timeRelative(date: Date | number | string): string {
  const ms  = new Date(date).getTime() - Date.now()
  const abs = Math.abs(ms)
  const s   = Math.floor(abs / 1000)
  const m   = Math.floor(s / 60)
  const h   = Math.floor(m / 60)
  const d   = Math.floor(h / 24)

  const label = d > 0 ? `${d}d` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : 'now'
  if (label === 'now') return 'now'
  return ms > 0 ? `in ${label}` : `${label} overdue`
}

export function formatSalary(min: number | null, max: number | null, currency: string | null): string {
  if (!min && !max) return ''
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'
  const fmt = (n: number) =>
    n >= 1000 ? `${sym}${Math.round(n / 1000)}K` : `${sym}${n}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (max) return `Up to ${fmt(max)}`
  return `From ${fmt(min!)}`
}

export const ATS_COLORS: Record<string, string> = {
  greenhouse:     'bg-green-100 text-green-800',
  ashby:          'bg-purple-100 text-purple-800',
  lever:          'bg-blue-100 text-blue-800',
  workable:       'bg-orange-100 text-orange-800',
  smartrecruiters:'bg-teal-100 text-teal-800',
  workday:        'bg-yellow-100 text-yellow-800',
  unknown:        'bg-gray-100 text-gray-600',
}

export const SENIORITY_COLORS: Record<string, string> = {
  intern:  'bg-blue-50 text-blue-700',
  junior:  'bg-green-50 text-green-700',
  mid:     'bg-yellow-50 text-yellow-800',
  senior:  'bg-orange-50 text-orange-800',
  staff:   'bg-red-50 text-red-700',
  unknown: 'bg-gray-50 text-gray-500',
}

export const LOCATION_ICONS: Record<string, string> = {
  remote: '🌐',
  hybrid: '🏠',
  onsite: '🏢',
  unknown: '📍',
}

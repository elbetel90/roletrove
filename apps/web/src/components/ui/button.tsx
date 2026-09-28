import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline'
  size?: 'sm' | 'md'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        size === 'md' && 'px-4 py-2 text-sm',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        variant === 'primary' &&
          'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700',
        variant === 'ghost' &&
          'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        variant === 'outline' &&
          'border border-gray-300 text-gray-700 hover:bg-gray-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

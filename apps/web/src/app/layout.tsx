import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { Nav } from '@/components/layout/nav'

export const metadata: Metadata = {
  title: {
    default: 'RoleTrove — Engineering Roles Aggregator',
    template: '%s | RoleTrove',
  },
  description:
    'Curated software engineering jobs from Greenhouse, Ashby, Lever, and more. Updated every 4 hours.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <Nav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}

import React from 'react'
import Link from 'next/link'
import '../src/app/globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="w-full border-b bg-white dark:bg-slate-900">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-emerald-700">Mari</Link>
            <nav className="flex items-center gap-4">
              <Link href="/dashboard" className="text-sm text-slate-700 dark:text-slate-200">Dashboard</Link>
              <Link href="/social/feed" className="text-sm text-slate-700 dark:text-slate-200">Feed</Link>
              <Link href="/api/auth/signin" className="text-sm font-medium text-emerald-700">Login</Link>
            </nav>
          </div>
        </header>

        <main className="min-h-[calc(100vh-64px)]">
          {children}
        </main>

        <footer className="w-full border-t mt-8 py-6 bg-white dark:bg-slate-900">
          <div className="max-w-6xl mx-auto px-4 text-sm text-slate-500">© Mari — Demo</div>
        </footer>
      </body>
    </html>
  )
}

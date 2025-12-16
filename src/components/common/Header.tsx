import Link from 'next/link'
import React from 'react'

export default function Header(){
  return (
    <header className="bg-white border-b shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Athena" className="w-8 h-8" />
          <span className="font-bold text-lg">Athena</span>
        </div>
        <nav>
          <ul className="flex items-center gap-4 text-sm">
            <li><Link href="/" className="text-gray-700 hover:text-emerald-600">Home</Link></li>
            <li><Link href="/dashboard" className="text-gray-700 hover:text-emerald-600">Dashboard</Link></li>
            <li><Link href="/social/feed" className="text-gray-700 hover:text-emerald-600">Feed</Link></li>
            <li><Link href="/login" className="text-sm font-medium text-emerald-700">Login</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  )
}

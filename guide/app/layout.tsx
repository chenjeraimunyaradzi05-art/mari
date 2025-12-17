import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Laravel → Next.js PoC',
  description: 'Migration proof of concept',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <header className="bg-blue-600 text-white p-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold">Laravel-to-Next.js Migration</h1>
            <p className="text-blue-100">Phase 0: PoC</p>
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-6">{children}</main>
        <footer className="bg-gray-100 p-4 text-center text-gray-600 mt-8">
          <p>MySQL + Next.js + Prisma + NextAuth.js</p>
        </footer>
      </body>
    </html>
  )
}

// app/page.tsx (Home page - converted from home.blade.php)
import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export default async function Home() {
  const session = await getServerSession(authOptions)

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-600 p-4">
        <h2 className="text-xl font-bold text-blue-600 mb-2">✅ PoC Active</h2>
        <p className="text-gray-700">
          You're running the Next.js proof of concept. This page replaced a Blade template.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded p-6">
          <h3 className="text-lg font-semibold mb-2">📊 System Status</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✅ Next.js 14 (App Router)</li>
            <li>✅ MySQL connected via Prisma</li>
            <li>✅ NextAuth.js configured</li>
            <li>✅ Redis available</li>
            <li>✅ TypeScript strict mode</li>
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded p-6">
          <h3 className="text-lg font-semibold mb-2">👤 Authentication</h3>
          {session ? (
            <div>
              <p className="text-sm text-gray-600 mb-2">Logged in as:</p>
              <p className="font-mono text-blue-600">{session.user?.email}</p>
              <Link
                href="/api/auth/signout"
                className="inline-block mt-3 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
              >
                Sign Out
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-2">Not authenticated</p>
              <Link
                href="/auth/signin"
                className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded p-6">
        <h3 className="text-lg font-semibold mb-4">🚀 Next Steps</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>
            Add your Prisma models to <code className="bg-gray-100 px-2 py-1">prisma/schema.prisma</code>
          </li>
          <li>
            Run <code className="bg-gray-100 px-2 py-1">npm run prisma:migrate</code> to sync your database
          </li>
          <li>Convert your first controller to an API route in <code className="bg-gray-100 px-2 py-1">app/api/</code></li>
          <li>Convert Blade templates to React components in <code className="bg-gray-100 px-2 py-1">app/</code></li>
          <li>Add tests for each unit of work</li>
          <li>Deploy to Vercel/Netlify for team review</li>
        </ol>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-4">
        <p className="text-sm text-amber-800">
          💡 <strong>Tip:</strong> Use <code className="bg-amber-100 px-2 py-1">npm run prisma:studio</code> to view your database
          in a web UI.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded p-6">
        <h3 className="text-lg font-semibold mb-4">📚 Available Pages</h3>
        <ul className="space-y-2">
          <li>
            <Link href="/auth/signin" className="text-blue-600 hover:underline">
              /auth/signin - Login page
            </Link>
          </li>
          <li>
            <Link href="/dashboard" className="text-blue-600 hover:underline">
              /dashboard - Protected page (requires auth)
            </Link>
          </li>
          <li>
            <a href="/api/auth/signin" className="text-blue-600 hover:underline">
              /api/auth/* - NextAuth.js endpoints
            </a>
          </li>
        </ul>
      </div>

      {session && (
        <div className="bg-green-50 border border-green-200 rounded p-4">
          <p className="text-sm text-green-800">
            ✅ You're authenticated! Try visiting <Link href="/dashboard" className="font-bold hover:underline">/dashboard</Link>
          </p>
        </div>
      )}
    </div>
  )
}

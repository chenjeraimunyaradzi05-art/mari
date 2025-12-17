// app/dashboard/page.tsx (Protected page example)
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/signin')
  }

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border-l-4 border-green-600 p-4">
        <h2 className="text-xl font-bold text-green-600 mb-2">✅ Protected Page</h2>
        <p className="text-gray-700">
          Only authenticated users can access this page. Middleware guards it automatically.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded p-6">
        <h3 className="text-lg font-semibold mb-4">User Details</h3>
        <div className="space-y-2 text-sm">
          <p>
            <strong>Email:</strong> <code className="bg-gray-100 px-2 py-1">{session.user?.email}</code>
          </p>
          <p>
            <strong>Name:</strong> <code className="bg-gray-100 px-2 py-1">{session.user?.name || 'N/A'}</code>
          </p>
          <p>
            <strong>ID:</strong> <code className="bg-gray-100 px-2 py-1">{(session.user as { id?: string })?.id}</code>
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded p-6">
        <h3 className="text-lg font-semibold mb-4">Migration Pattern</h3>
        <p className="text-gray-700 mb-2">
          This page demonstrates how to:
        </p>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>Protect pages with authentication middleware</li>
          <li>Access session data server-side</li>
          <li>Redirect unauthenticated users to sign-in</li>
          <li>Build protected Blade templates → Next.js pages</li>
        </ul>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-4">
        <p className="text-sm text-amber-800">
          💡 Use this pattern for all protected pages in your Laravel app.
        </p>
      </div>
    </div>
  )
}

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ProfileForm from '@/components/ProfileForm'
import type { Profile as PrismaProfile } from '@prisma/client'

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-4">You need to <a className="text-blue-600" href="/auth/signin">sign in</a> to edit your profile.</p>
      </main>
    )
  }

  let userId: string | undefined = (session.user as { id?: string; email?: string })?.id
  if (!userId && session.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } })
    userId = u?.id
  }

  const profile: PrismaProfile | null = userId ? await prisma.profile.findFirst({ where: { userId } }) : null

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-2 text-sm text-gray-600">Update your public profile information.</p>
      <div className="mt-6">
        <ProfileForm profile={profile} />
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">Security</h2>
        <div className="mt-3 space-x-3">
          <a href="/profile/change-password" className="px-3 py-2 bg-yellow-500 text-white rounded">Change password</a>
          <button
            id="delete-account"
            className="px-3 py-2 bg-red-600 text-white rounded"
            onClick={async () => {
              if (!confirm('Delete your account? This is irreversible.')) return
              try {
                const res = await fetch('/api/profile/delete', { method: 'DELETE' })
                if (!res.ok) {
                  const json = await res.json()
                  alert(json.error || 'Delete failed')
                } else {
                  // Sign out and redirect
                  window.location.href = '/'
                }
              } catch (err) {
                console.error(err)
                alert('Network error')
              }
            }}
          >
            Delete account
          </button>
        </div>
      </div>
    </main>
  )
}

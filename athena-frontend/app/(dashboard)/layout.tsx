import { ReactNode, useEffect } from 'react'
import { RoleBadge } from '@/components/common/RoleBadge'
import { useAuthStore } from '@/lib/stores/authStore'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const init = useAuthStore((s) => (s as any).init)

  useEffect(() => {
    if (init) init()
  }, [init])

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b py-4">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-semibold">Dashboard</div>
            <RoleBadge role={user?.name ? 'member' : undefined} />
          </div>
        </div>
      </div>
      <div className="container py-8">{children}</div>
    </div>
  )
}

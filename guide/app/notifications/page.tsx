import React from 'react'

async function getNotifications() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/notifications`, { cache: 'no-store' })
  if (!res.ok) return { notifications: [] }
  return res.json()
}

export default async function NotificationsPage() {
  const data = await getNotifications()
  const notes = data.notifications || []

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Notifications</h1>
      <div className="space-y-3">
        {notes.map((n: any) => (
          <div key={n.id} className={`p-3 border rounded ${n.isRead ? '' : 'bg-gray-50'}`}>
            <div className="text-sm text-gray-800">{n.type}</div>
            <div className="text-xs text-gray-600">{n.data?.excerpt ?? JSON.stringify(n.data)}</div>
            <div className="text-sm text-gray-500">{new Date(n.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

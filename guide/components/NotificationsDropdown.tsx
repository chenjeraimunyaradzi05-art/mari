"use client"
import React, { useEffect, useState } from 'react'

export default function NotificationsDropdown() {
  const [notes, setNotes] = useState<any[]>([])
  const [open, setOpen] = useState(false)

  async function load() {
    try {
      const res = await fetch('/api/notifications')
      const j = await res.json()
      setNotes(j.notifications || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { load() }, [])

  async function markRead(id: string) {
    await fetch('/api/notifications/mark-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) })
    load()
  }

  const unread = notes.filter(n => !n.isRead).length

  return (
    <div className="relative inline-block">
      <button className="btn" onClick={() => { setOpen(!open); if (!open) load() }}>
        Notifications {unread > 0 && <span className="ml-2 text-sm text-red-600">({unread})</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border shadow rounded p-2 z-50">
          {notes.length === 0 && <div className="p-2 text-sm text-gray-500">No notifications</div>}
          {notes.map(n => (
            <div key={n.id} className={`p-2 ${n.isRead ? 'bg-white' : 'bg-gray-50'} rounded mb-1`}>
              <div className="text-sm font-medium">{n.type}</div>
              <div className="text-xs text-gray-600">{n.data?.excerpt ? n.data.excerpt : JSON.stringify(n.data)}</div>
              <div className="text-right mt-1">
                {!n.isRead && <button className="text-xs text-blue-600" onClick={() => markRead(n.id)}>Mark read</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

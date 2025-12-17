"use client"
import React, { useState } from 'react'

export default function ComposeMessage({ conversationId }: { conversationId: string }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        setContent('')
        // simple approach: reload to show new message
        window.location.reload()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={send} className="space-y-2">
      <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full p-2 border rounded" rows={3} />
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={loading || !content.trim()} type="submit">Send</button>
      </div>
    </form>
  )
}

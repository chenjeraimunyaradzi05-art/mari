"use client"
import React, { useEffect, useState } from 'react'

export default function ConversationList() {
  const [conversations, setConversations] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((j) => {
        if (mounted) setConversations(j.conversations || [])
      })
      .catch((e) => console.error(e))
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-2">
      {conversations.map((c) => (
        <a key={c.id} className="block p-3 border rounded hover:bg-gray-50" href={`/conversations/${c.id}`}>
          <div className="flex justify-between">
            <div>
              <strong>{c.title ?? 'Conversation'}</strong>
              <div className="text-sm text-gray-600">{c.lastMessage?.content ? c.lastMessage.content.slice(0, 80) : 'No messages yet'}</div>
            </div>
            <div className="text-sm text-gray-500">{c.lastMessage ? new Date(c.lastMessage.createdAt).toLocaleString() : ''}</div>
          </div>
        </a>
      ))}
    </div>
  )
}

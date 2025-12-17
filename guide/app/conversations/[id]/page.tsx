import React from 'react'
import ComposeMessage from '@/components/ComposeMessage'

async function getMessages(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/conversations/${id}/messages`, { cache: 'no-store' })
  if (!res.ok) return { messages: [] }
  return res.json()
}

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const data = await getMessages(params.id)
  const messages = data.messages || []

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Conversation</h1>
        <a className="text-sm text-blue-600" href="/conversations">Back to list</a>
      </div>

      <div className="bg-white shadow rounded p-4 mb-4">
        <div className="space-y-3">
          {messages.map((m: any) => (
            <div key={m.id} className="p-2 border rounded">
              <div className="text-sm text-gray-700"><strong>{m.author?.name ?? m.authorId}</strong> · <small className="text-gray-500">{new Date(m.createdAt).toLocaleString()}</small></div>
              <div className="mt-2 text-sm text-gray-800">{m.content}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow rounded p-4">
        <ComposeMessage conversationId={params.id} />
      </div>
    </div>
  )
}

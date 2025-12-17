import React from 'react'
import ConversationList from '@/components/ConversationList'

export default function ConversationsPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Conversations</h1>
      </div>

      <div>
        <ConversationList />
      </div>
    </div>
  )
}

'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import Link from 'next/link';

interface Conversation {
  partner: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
  lastMessage: {
    content: string;
    createdAt: string;
  };
  unreadCount: number;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConversations() {
      try {
        const res = await fetch('/api/social/conversations');
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      } catch (error) {
        console.error('Failed to fetch conversations', error);
      } finally {
        setLoading(false);
      }
    }
    fetchConversations();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white z-10 border-b border-slate-100">
        <div className="flex items-center p-4">
          <Link href="/social/feed" className="p-2 -ml-2 hover:bg-slate-50 rounded-full">
            <ArrowLeft className="w-6 h-6 text-slate-900" />
          </Link>
          <h1 className="font-bold text-lg ml-2">Messages</h1>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-bold text-slate-900">No messages yet</h3>
            <p className="text-slate-500 text-sm mt-1">Start a conversation from a profile.</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <Link 
              key={conv.partner.id} 
              href={`/social/messages/${conv.partner.id}`}
              className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden">
                  {conv.partner.profileImage ? (
                    <img src={conv.partner.profileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-slate-500">
                      {conv.partner.firstName[0]}
                    </div>
                  )}
                </div>
                {conv.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
                    {conv.unreadCount}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-bold text-slate-900 truncate">
                    {conv.partner.firstName} {conv.partner.lastName}
                  </h3>
                  <span className="text-xs text-slate-400 shrink-0">
                    {new Date(conv.lastMessage.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                  {conv.lastMessage.content}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

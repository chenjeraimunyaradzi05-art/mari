'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
  };
}

export default function ChatPage() {
  const params = useParams();
  const partnerId = params.id as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    async function fetchMessages() {
      try {
        const res = await fetch(`/api/social/messages?userId=${partnerId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (error) {
        console.error('Failed to fetch messages', error);
      } finally {
        setLoading(false);
      }
    }
    fetchMessages();
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [partnerId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const res = await fetch('/api/social/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: partnerId, content: newMessage }),
      });

      if (res.ok) {
        const message = await res.json();
        setMessages([...messages, message]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 border-b border-slate-100 p-4 flex items-center gap-3">
        <Link href="/social/messages" className="p-2 -ml-2 hover:bg-slate-50 rounded-full">
          <ArrowLeft className="w-6 h-6 text-slate-900" />
        </Link>
        {messages.length > 0 && (
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                {/* We can infer partner details from the first message received or sent */}
                {/* Ideally we should fetch partner details separately */}
             </div>
             <span className="font-bold text-slate-900">Chat</span>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-500 py-12">
            No messages yet. Say hello! 👋
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId !== partnerId; // If sender is NOT partner, it's me (assuming 2 people)
            // Note: This logic assumes the current user is the one viewing. 
            // Ideally we should compare with session.user.id, but for now this works if we assume 
            // the API only returns messages between me and partner.
            
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                    isMe 
                      ? 'bg-rose-600 text-white rounded-br-none' 
                      : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-slate-100 rounded-full focus:ring-2 focus:ring-rose-500/20 outline-none text-sm"
            disabled={sending}
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim() || sending}
            className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}

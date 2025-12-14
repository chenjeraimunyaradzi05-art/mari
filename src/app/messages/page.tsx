'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MessagesPage() {
  const [activeConversation, setActiveConversation] = useState<number | null>(1);
  const [messageInput, setMessageInput] = useState('');

  // Mock Data
  const conversations = [
    {
      id: 1,
      name: "Sarah Jenkins",
      avatar: "bg-pink-200 text-pink-700",
      lastMessage: "That sounds great! Let's schedule it.",
      time: "10:32 AM",
      unread: 0,
      online: true
    },
    {
      id: 2,
      name: "TechFlow Recruiters",
      avatar: "bg-blue-200 text-blue-700",
      lastMessage: "We'd love to interview you for the Senior role.",
      time: "Yesterday",
      unread: 2,
      online: false
    },
    {
      id: 3,
      name: "Jessica Williams",
      avatar: "bg-purple-200 text-purple-700",
      lastMessage: "Thanks for connecting!",
      time: "2 days ago",
      unread: 0,
      online: false
    }
  ];

  const messages = [
    {
      id: 1,
      sender: "Sarah Jenkins",
      content: "Hey! How are you doing?",
      time: "10:30 AM",
      isMe: false
    },
    {
      id: 2,
      sender: "Me",
      content: "Doing great! Just working on some new projects.",
      time: "10:31 AM",
      isMe: true
    },
    {
      id: 3,
      sender: "Sarah Jenkins",
      content: "That sounds exciting. I'd love to hear more about it.",
      time: "10:32 AM",
      isMe: false
    }
  ];

  const suggestions = [
    "That sounds great!",
    "Let's schedule a call.",
    "I'll send you the details."
  ];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    // In a real app, this would send the message
    setMessageInput('');
  };

  return (
    <div className="aura-container py-8 h-[calc(100vh-80px)]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        
        {/* Conversation List */}
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Messages</h2>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search conversations..." 
                className="w-full pl-10 pr-4 py-2 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-indigo-500 transition-colors"
              />
              <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-l-4 ${activeConversation === conv.id ? 'border-indigo-600 bg-indigo-50/50' : 'border-transparent'}`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${conv.avatar}`}>
                  {conv.name.charAt(0)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className={`font-bold truncate ${activeConversation === conv.id ? 'text-indigo-900' : 'text-slate-900'}`}>{conv.name}</h3>
                    <span className="text-xs text-slate-500 flex-shrink-0">{conv.time}</span>
                  </div>
                  <p className={`text-sm truncate ${conv.unread > 0 ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                    {conv.lastMessage}
                  </p>
                </div>
                {conv.unread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-pink-500 text-white text-xs font-bold flex items-center justify-center">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveConversation(null)} className="md:hidden text-slate-500 mr-2">
                    ←
                  </button>
                  <div className="w-10 h-10 rounded-full bg-pink-200 text-pink-700 flex items-center justify-center font-bold">
                    S
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Sarah Jenkins</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs text-slate-500">Online</span>
                    </div>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                  ℹ️
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-3 ${msg.isMe ? 'justify-end' : ''}`}>
                    {!msg.isMe && (
                      <div className="w-8 h-8 rounded-full bg-pink-200 text-pink-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">
                        S
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <p className={`text-[10px] mt-1 text-right ${msg.isMe ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.time}</p>
                    </div>
                  </div>
                ))}
                
                {/* AI Suggestion Indicator */}
                <div className="flex justify-center">
                   <div className="bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 flex items-center gap-2">
                      <span className="text-lg">✨</span>
                      <span className="text-xs font-bold text-indigo-700">AI Suggestion ready</span>
                   </div>
                </div>
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-slate-100 bg-white">
                {/* Quick Replies */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                  {suggestions.map((suggestion, i) => (
                    <button 
                      key={i}
                      onClick={() => setMessageInput(suggestion)}
                      className="whitespace-nowrap px-4 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="flex gap-3">
                  <button type="button" className="p-3 text-slate-400 hover:text-indigo-600 transition-colors rounded-full hover:bg-slate-50">
                    📎
                  </button>
                  <input 
                    type="text" 
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..." 
                    className="flex-1 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
                  />
                  <button type="submit" className="aura-btn aura-btn-primary px-6">
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-4xl mb-6 text-indigo-600">
                💬
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Select a conversation</h3>
              <p className="text-slate-500 max-w-xs">Choose a thread from the list to start chatting or find new connections.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

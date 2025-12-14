"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import '../dashboard/shared-dashboard.css';
import { Card, SectionHeader, Pill } from '@/components/ui';

type Conversation = {
  id: string;
  name: string;
  avatar: string;
  preview: string;
  lastSeen: string;
  unread: number;
  status: 'online' | 'away' | 'offline';
};

type Message = {
  id: string;
  from: string;
  body: string;
  time: string;
  isOwn: boolean;
};

const quickReactions = ['👍', '❤️', '🎉', '👏', '🔥'];
const fallbackSuggestions = [
  'Thanks for the intro—excited to learn more about the role and team.',
  'Can we add a timebox for QA so I can plan deliverables?',
  'Here is my availability this week for a quick sync.',
];

export default function SocialPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(fallbackSuggestions);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setConversationsLoading(true);
      setConversationsError('');
      try {
        const res = await fetch('/api/social/conversations');
        if (!res.ok) throw new Error('Failed to load conversations');
        const json = await res.json();
        if (mounted) {
          setConversations(json.data || []);
          setActiveId((json.data?.[0]?.id as string | undefined) ?? null);
        }
      } catch {
        if (mounted) setConversationsError('Could not load conversations.');
      } finally {
        if (mounted) setConversationsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setDraft('');
    setSendError('');
    setShowSuggestions(false);
    setSuggestionsError('');
    setSuggestions(fallbackSuggestions);
    let mounted = true;
    const load = async () => {
      setMessagesLoading(true);
      setMessagesError('');
      try {
        const res = await fetch(`/api/social/messages?conversationId=${activeId}`);
        if (!res.ok) throw new Error('Failed to load messages');
        const json = await res.json();
        if (mounted) setMessages(json.data || []);
      } catch {
        if (mounted) setMessagesError('Could not load messages.');
      } finally {
        if (mounted) setMessagesLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [activeId]);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  const loadSuggestions = async () => {
    const context = active
      ? `Conversation with ${active.name}. Latest preview: ${active.preview || 'N/A'}. Draft: ${draft || 'No draft yet.'}`
      : `General conversation. Draft: ${draft || 'No draft yet.'}`;

    setSuggestionsLoading(true);
    setSuggestionsError('');
    try {
      const res = await fetch('/api/social/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: context }),
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const incoming = Array.isArray(json.data) && json.data.length ? json.data : fallbackSuggestions;
      setSuggestions(incoming as string[]);
    } catch {
      setSuggestionsError('Could not load AI suggestions. Showing defaults.');
      setSuggestions(fallbackSuggestions);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    setSendError('');
    try {
      const res = await fetch('/api/social/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeId, body: draft }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      const json = await res.json();
      setMessages((prev) => [...prev, json.data]);
      setDraft('');
    } catch {
      setSendError('Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const toggleSuggestions = () => {
    setShowSuggestions((next) => {
      const open = !next;
      if (open) loadSuggestions();
      return open;
    });
  };

  return (
    <main
      className="dash-shell"
      aria-label="Social and messaging"
      style={{
        background:
          'radial-gradient(circle at 16% 12%, rgba(233,30,140,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(139,92,246,0.08), transparent 28%), var(--background)',
      }}
    >
      <div className="dash-container" style={{ display: 'grid', gap: 18 }}>
        <Card
          tone="primary"
          padding={26}
          style={{ boxShadow: '0 18px 42px -28px rgba(233,30,140,0.48)' }}
        >
          <SectionHeader
            eyebrow="Athena social"
            title="Messages, mentors, and network handoffs"
            subtitle="Privacy-safe DMs with AI suggestions for networking, jobs, and wellness."
            actions={<button className="btn-primary-gradient">New message</button>}
            tone="dark"
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <Pill tone="light">Women-first safety</Pill>
            <Pill tone="light">AI suggestions</Pill>
            <Pill tone="light">Mute & report controls</Pill>
          </div>
        </Card>

        <section className="dash-grid" style={{ gridTemplateColumns: '1fr 1.6fr', alignItems: 'start' }}>
          <Card style={{ padding: 0, boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
              <p className="stat-label" style={{ marginBottom: 6 }}>Conversations</p>
              <div className="search-row">
                <input className="input" placeholder="Search conversations" />
              </div>
              {conversationsLoading && <p className="stat-context" style={{ marginTop: 6 }}>Loading conversations…</p>}
              {conversationsError && <p className="stat-context" style={{ marginTop: 6, color: '#b91c1c' }}>{conversationsError}</p>}
            </div>
            <div style={{ display: 'grid', gap: 0 }}>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveId(conv.id)}
                  style={{
                    border: 'none',
                    background: conv.id === active?.id ? 'rgba(233,30,140,0.05)' : '#fff',
                    borderTop: '1px solid var(--border)',
                    padding: '12px 16px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <Image src={conv.avatar} alt={conv.name} width={46} height={46} style={{ borderRadius: 12, objectFit: 'cover', boxShadow: '0 6px 18px -12px rgba(233,30,140,0.55)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <p style={{ margin: 0, fontWeight: 700 }}>{conv.name}</p>
                      <span className="stat-context">{conv.lastSeen}</span>
                    </div>
                    <p className="stat-context" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.preview}</p>
                  </div>
                  {conv.unread > 0 && <span className="badge-soft" style={{ background: 'rgba(233,30,140,0.12)', color: '#9d174d' }}>{conv.unread}</span>}
                </button>
              ))}
              {!conversationsLoading && conversations.length === 0 && (
                <p className="stat-context" style={{ padding: 16, margin: 0 }}>No conversations yet.</p>
              )}
            </div>
          </Card>

          <Card style={{ padding: 0, boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card)' }}>
              {active ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Image src={active.avatar} alt={active.name} width={52} height={52} style={{ borderRadius: 14, objectFit: 'cover', boxShadow: '0 8px 24px -16px rgba(233,30,140,0.55)' }} />
                    <div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{active.name}</p>
                      <p className="stat-context" style={{ margin: 0 }}>
                        <i className="fas fa-circle" style={{ color: active.status === 'online' ? '#22c55e' : '#94a3b8', marginRight: 6 }} />
                        {active.status === 'online' ? 'Online' : `Seen ${active.lastSeen}`}
                      </p>
                    </div>
                  </div>
                  <button className="btn-ghost">Mute</button>
                </>
              ) : (
                <p className="stat-context" style={{ margin: 0 }}>Select a conversation.</p>
              )}
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 10, background: 'rgba(255,255,255,0.72)', minHeight: 320 }}>
              {messagesLoading && <p className="stat-context">Loading messages…</p>}
              {messagesError && <p className="stat-context" style={{ color: '#b91c1c' }}>{messagesError}</p>}
              {!messagesLoading && !messagesError && messages.length === 0 && (
                <p className="stat-context">No messages yet.</p>
              )}
              {!messagesLoading &&
                messages.map((msg) => (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.isOwn ? 'flex-end' : 'flex-start' }}>
                    <div
                      style={{
                        maxWidth: '78%',
                        padding: '10px 12px',
                        borderRadius: 14,
                        background: msg.isOwn ? 'rgba(233,30,140,0.08)' : '#fff',
                        border: '1px solid var(--border)',
                        boxShadow: '0 14px 28px -24px rgba(233,30,140,0.55)',
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 600 }}>{msg.from}</p>
                      <p style={{ margin: '4px 0', color: '#0f172a' }}>{msg.body}</p>
                      <p className="stat-context" style={{ margin: 0 }}>{msg.time}</p>
                    </div>
                  </div>
                ))}
            </div>

            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'grid', gap: 10, background: 'var(--card)' }}>
              <textarea
                className="textarea"
                rows={3}
                placeholder={active ? 'Type a message...' : 'Select a conversation to start messaging'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!active || sending}
              />
              {sendError && <p className="stat-context" style={{ color: '#b91c1c', margin: 0 }}>{sendError}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {quickReactions.map((reaction) => (
                    <button
                      key={reaction}
                      className="btn-ghost"
                      style={{ padding: '8px 10px' }}
                      type="button"
                      disabled={!active || sending}
                      onClick={() => setDraft((prev) => `${prev ? `${prev} ` : ''}${reaction}`)}
                    >
                      {reaction}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn-ghost"
                    type="button"
                    disabled={!active || sending}
                    onClick={toggleSuggestions}
                    style={{ color: 'var(--accent)' }}
                  >
                    AI suggestions
                  </button>
                  <button
                    className="btn-primary-gradient"
                    type="button"
                    onClick={handleSend}
                    disabled={!active || sending || !draft.trim()}
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
              {showSuggestions && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.9)', display: 'grid', gap: 8 }}>
                  {suggestionsLoading && <p className="stat-context" style={{ margin: 0 }}>Loading AI suggestions…</p>}
                  {suggestionsError && <p className="stat-context" style={{ margin: 0, color: '#b91c1c' }}>{suggestionsError}</p>}
                  {!suggestionsLoading &&
                    suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setDraft(suggestion);
                          setShowSuggestions(false);
                        }}
                        style={{
                          textAlign: 'left',
                          background: '#fff',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: '8px 10px',
                          cursor: 'pointer',
                          boxShadow: '0 10px 24px -18px rgba(233,30,140,0.45)',
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </Card>
        </section>

        <section className="dash-grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
          <Card style={{ boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <p className="stat-label">AI suggestions</p>
            <h3 style={{ margin: '4px 0 10px' }}>Context-ready replies</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {suggestions.map((suggestion) => (
                <div key={suggestion} className="card-plain" style={{ border: '1px solid #e5e7eb', background: '#f8fafc' }}>
                  <p style={{ margin: 0 }}>{suggestion}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ boxShadow: '0 18px 36px -28px rgba(233,30,140,0.35)' }}>
            <p className="stat-label">Safety & reporting</p>
            <h3 style={{ margin: '4px 0 10px' }}>Women-first controls</h3>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#475569' }}>
              <li>Inline report for harmful content</li>
              <li>Mute & block in one tap</li>
              <li>Redaction hints for sensitive data</li>
            </ul>
          </Card>
        </section>
      </div>
    </main>
  );
}

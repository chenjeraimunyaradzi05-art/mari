'use client';

/**
 * The one form behind the site's enquiries: the waitlist, sales, partner,
 * press and influencer contact. It creates a Lead the marketing hub works
 * from and, for the waitlist, tells the person their real place in the
 * queue. utm parameters on the page URL are passed along so a campaign
 * gets the credit.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type Source = 'WAITLIST' | 'CONTACT_SALES' | 'PARTNER' | 'PRESS' | 'INFLUENCER';

interface LeadFormProps {
  source: Source;
  /** Field set: the waitlist asks for interest; enquiries ask for organisation and a message. */
  variant?: 'waitlist' | 'enquiry';
  submitLabel?: string;
  interestOptions?: string[];
  /** A fixed interest sent with every submission, e.g. "funding" on the funding enquiry page. */
  fixedInterest?: string;
  onDone?: (result: { position: number | null; email: string }) => void;
}

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

function utmFromUrl(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const p = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const [key, name] of [
    ['utm_source', 'utmSource'],
    ['utm_medium', 'utmMedium'],
    ['utm_campaign', 'utmCampaign'],
  ]) {
    const v = p.get(key);
    if (v) out[name] = v.slice(0, 100);
  }
  return out;
}

export default function LeadForm({ source, variant = 'enquiry', submitLabel, interestOptions, fixedInterest, onDone }: LeadFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [interest, setInterest] = useState(interestOptions?.[0] ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<{ position: number | null; email: string } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await api.post('/marketing/leads', {
        email: email.trim(),
        source,
        name: name.trim() || undefined,
        organisation: organisation.trim() || undefined,
        interest: fixedInterest || interest || undefined,
        message: message.trim() || undefined,
        ...utmFromUrl(),
      });
      const out = { position: (res.data?.data?.position as number | null) ?? null, email: email.trim() };
      setResult(out);
      onDone?.(out);
    } catch (e) {
      setProblem(errorMessage(e) || 'That did not go through. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100">
        {variant === 'waitlist' && result.position ? (
          <>
            You are <strong>#{result.position.toLocaleString('en-AU')}</strong> on the waitlist. We will email you when your place opens.
          </>
        ) : (
          <>Thanks. We have your message and will reply to {email.trim()}.</>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" maxLength={120} className="input w-full" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@example.com" aria-label="Email" maxLength={254} className="input w-full" />
      </div>
      {variant === 'waitlist' ? (
        interestOptions && interestOptions.length > 0 ? (
          <select value={interest} onChange={(e) => setInterest(e.target.value)} aria-label="What brings you here" className="input w-full">
            {interestOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : null
      ) : (
        <>
          <input value={organisation} onChange={(e) => setOrganisation(e.target.value)} placeholder="Organisation (optional)" aria-label="Organisation" maxLength={160} className="input w-full" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="What would you like to talk about?" aria-label="Message" maxLength={4000} className="input w-full" />
        </>
      )}
      {problem && <p className="text-sm text-red-600">{problem}</p>}
      <button type="submit" disabled={busy} className="btn-primary inline-flex items-center gap-2">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel ?? (variant === 'waitlist' ? 'Join the waitlist' : 'Send')}
      </button>
    </form>
  );
}

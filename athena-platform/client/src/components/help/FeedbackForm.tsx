'use client';

/**
 * The feedback form. It posts to the platform, so what people say lands in
 * front of staff at /admin/feedback rather than in one person's inbox. A
 * signed-in member is attached by account; a visitor can leave an email.
 */

import { FormEvent, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const CATEGORIES: Array<[string, string]> = [
  ['BUG', 'Something is broken'],
  ['IDEA', 'An idea or a request'],
  ['PRAISE', 'Something is working well'],
  ['OTHER', 'Something else'],
];

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

export default function FeedbackForm() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [category, setCategory] = useState('BUG');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await api.post('/feedback', {
        category,
        message: message.trim(),
        email: isAuthenticated ? undefined : email.trim() || undefined,
        page: typeof document !== 'undefined' && document.referrer ? document.referrer.slice(0, 300) : undefined,
      });
      setSent(true);
    } catch (e) {
      setProblem(errorMessage(e) || 'That did not send. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100">
        Thank you. It is with the team now.{isAuthenticated || email.trim() ? ' We will reply if there is something to say back.' : ''}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {CATEGORIES.map(([value, text]) => (
          <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${category === value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-border'}`}>
            <input type="radio" name="category" value={value} checked={category === value} onChange={() => setCategory(value)} className="accent-primary-600" />
            {text}
          </label>
        ))}
      </div>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required minLength={10} maxLength={4000} placeholder="What were you trying to do, and what happened?" aria-label="Your feedback" className="input w-full" />
      {!isAuthenticated && <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Your email, if you would like a reply (optional)" aria-label="Email" maxLength={254} className="input w-full" />}
      {problem && <p className="text-sm text-red-600">{problem}</p>}
      <button type="submit" disabled={busy || message.trim().length < 10} className="btn-primary inline-flex items-center gap-2">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send feedback
      </button>
    </form>
  );
}

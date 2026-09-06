'use client';

/**
 * Verification badges. Identity runs through Stripe Identity where the server
 * has it set up (document plus selfie on Stripe's hosted page); otherwise, and
 * for employer, educator, mentor and creator badges, the member applies and a
 * person reviews it. Notifications about verification have linked here since
 * the beginning; the page did not exist.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, BadgeCheck, Clock, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type BadgeType = 'IDENTITY' | 'EMPLOYER' | 'EDUCATOR' | 'MENTOR' | 'CREATOR';
type Badge = { id: string; type: BadgeType; status: 'PENDING' | 'APPROVED' | 'REJECTED'; metadata: Record<string, unknown> | null; reason: string | null; submittedAt: string; reviewedAt: string | null };

const BADGES: Array<{ type: BadgeType; title: string; blurb: string; fields: Array<{ key: string; label: string; placeholder: string }> }> = [
  { type: 'IDENTITY', title: 'Identity', blurb: 'Proves you are who you say you are. Shows a verified tick on your profile.', fields: [{ key: 'note', label: 'Anything the reviewer should know', placeholder: 'Optional' }] },
  {
    type: 'EMPLOYER',
    title: 'Employer',
    blurb: 'For people who hire on ATHENA on behalf of an organisation.',
    fields: [
      { key: 'organisation', label: 'Organisation', placeholder: 'Company or agency name' },
      { key: 'role', label: 'Your role', placeholder: 'e.g. Talent lead' },
      { key: 'evidenceUrl', label: 'Where we can confirm it', placeholder: 'Team page, LinkedIn, or a work email domain' },
    ],
  },
  {
    type: 'EDUCATOR',
    title: 'Educator',
    blurb: 'For teachers and training providers publishing courses.',
    fields: [
      { key: 'organisation', label: 'Institution or provider', placeholder: 'e.g. TAFE Queensland' },
      { key: 'evidenceUrl', label: 'Where we can confirm it', placeholder: 'Staff page or registration' },
    ],
  },
  {
    type: 'MENTOR',
    title: 'Mentor',
    blurb: 'For mentors who want their experience confirmed.',
    fields: [
      { key: 'role', label: 'Current role', placeholder: 'e.g. Head of Product, 12 years' },
      { key: 'evidenceUrl', label: 'Where we can confirm it', placeholder: 'LinkedIn or a company page' },
    ],
  },
  {
    type: 'CREATOR',
    title: 'Creator',
    blurb: 'For creators with an audience elsewhere.',
    fields: [
      { key: 'evidenceUrl', label: 'Your main channel', placeholder: 'YouTube, Instagram, Substack…' },
      { key: 'note', label: 'Audience size, roughly', placeholder: 'e.g. 12k on Instagram' },
    ],
  },
];

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const errorStatus = (e: unknown) => (e as { response?: { status?: number } })?.response?.status;

export default function VerificationSettingsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const justReturned = searchParams.get('identity') === 'done';
  const [open, setOpen] = useState<BadgeType | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [identityUnavailable, setIdentityUnavailable] = useState<string | null>(null);

  const badges = useQuery({
    queryKey: ['verification-badges'],
    queryFn: () => api.get('/verification/badges'),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Badge[]) : []),
    refetchInterval: justReturned ? 10000 : false,
  });

  useEffect(() => {
    if (justReturned) queryClient.invalidateQueries({ queryKey: ['verification-badges'] });
  }, [justReturned, queryClient]);

  const startIdentity = useMutation({
    mutationFn: () => api.post('/verification/identity/session'),
    onSuccess: (res) => {
      const url = res.data?.data?.url as string | undefined;
      if (url) window.location.assign(url);
      else toast.error('Stripe did not return a page to open');
    },
    onError: (e) => {
      if (errorStatus(e) === 503) {
        setIdentityUnavailable(errorMessage(e) || 'Automated checks are not available; apply below instead.');
        setOpen('IDENTITY');
      } else {
        toast.error(errorMessage(e) || 'Could not start the identity check');
      }
    },
  });

  const apply = useMutation({
    mutationFn: (type: BadgeType) => api.post('/verification/badges', { type, metadata: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-badges'] });
      setOpen(null);
      setForm({});
      toast.success('Application sent. A person will review it.');
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not send the application'),
  });

  const latestOf = (type: BadgeType) => badges.data?.filter((b) => b.type === type).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <Link href="/dashboard/settings" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        <ArrowLeft className="mr-2 h-4 w-4" /> Settings
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <BadgeCheck className="h-7 w-7 text-primary-500" /> Verification
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">Badges tell other members what has been confirmed about you. Each one is reviewed; none is required.</p>
      </div>

      {justReturned && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
          Thanks. Stripe is checking your documents; this usually takes a minute or two. We will tell you here and by notification when it is done.
        </div>
      )}

      {badges.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {BADGES.map((def) => {
            const latest = latestOf(def.type);
            const isOpen = open === def.type;
            return (
              <section key={def.type} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                      {def.title}
                      {latest?.status === 'APPROVED' && <ShieldCheck className="h-4 w-4 text-emerald-600" aria-label="Verified" />}
                    </h2>
                    <p className="text-sm text-slate-500">{def.blurb}</p>
                    {latest && (
                      <p className={cn('mt-1 inline-flex items-center gap-1 text-xs', latest.status === 'APPROVED' ? 'text-emerald-700' : latest.status === 'REJECTED' ? 'text-red-600' : 'text-amber-700')}>
                        {latest.status === 'APPROVED' ? <ShieldCheck className="h-3.5 w-3.5" /> : latest.status === 'REJECTED' ? <XCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        {latest.status === 'APPROVED' ? 'Verified' : latest.status === 'REJECTED' ? 'Not approved' : 'Under review'}
                        {latest.reason ? ` · ${latest.reason}` : ''}
                      </p>
                    )}
                  </div>
                  {latest?.status !== 'APPROVED' && !isOpen && (
                    <div className="flex flex-wrap gap-2">
                      {def.type === 'IDENTITY' && !identityUnavailable && (
                        <button type="button" onClick={() => startIdentity.mutate()} disabled={startIdentity.isPending} className="btn-primary text-sm">
                          {startIdentity.isPending ? 'Opening…' : latest?.status === 'PENDING' ? 'Try the check again' : 'Verify with a document'}
                        </button>
                      )}
                      {(def.type !== 'IDENTITY' || identityUnavailable) && (
                        <button type="button" onClick={() => setOpen(def.type)} className={cn('text-sm', def.type === 'IDENTITY' ? 'btn-primary' : 'btn-outline')} disabled={latest?.status === 'PENDING' && def.type !== 'IDENTITY'}>
                          {latest?.status === 'PENDING' ? 'Application sent' : latest?.status === 'REJECTED' ? 'Apply again' : 'Apply'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isOpen && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      apply.mutate(def.type);
                    }}
                    className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800"
                  >
                    {def.type === 'IDENTITY' && identityUnavailable && <p className="text-sm text-slate-600 dark:text-slate-300">{identityUnavailable}</p>}
                    {def.fields.map((f) => (
                      <label key={f.key} className="block text-sm text-slate-700 dark:text-slate-300">
                        {f.label}
                        <input value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} maxLength={300} className="input mt-1 w-full text-sm" />
                      </label>
                    ))}
                    <div className="flex gap-2">
                      <button type="submit" disabled={apply.isPending} className="btn-primary text-sm">
                        {apply.isPending ? 'Sending…' : 'Send application'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(null);
                          setForm({});
                        }}
                        className="text-sm text-slate-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

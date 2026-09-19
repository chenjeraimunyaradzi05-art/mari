'use client';

/**
 * Practitioners waiting to be verified. A GP, psychologist or dietitian who
 * fills in /dashboard/wellness/practice lands here until a person has checked
 * her against the AHPRA register (or her professional body, for the kinds
 * AHPRA does not register). Verify puts her in Find care; Hide takes the
 * profile out of the queue. She is told either way.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Stethoscope, X } from 'lucide-react';
import { wellnessApi, wellnessError } from '@/lib/wellness-api';
import { cn } from '@/lib/utils';

type Pending = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  kindLabel: string;
  headline: string;
  bio: string;
  qualifications: string[];
  specialties: string[];
  suburb: string | null;
  city: string | null;
  state: string | null;
  ahpraNumber: string | null;
  website: string | null;
  phone: string | null;
  telehealth: boolean;
  inPerson: boolean;
  createdAt: string;
  owner: { id: string; name: string; email: string } | null;
};

const AHPRA_REGISTER = 'https://www.ahpra.gov.au/Registration/Registers-of-Practitioners.aspx';

const where = (p: Pending) => [p.suburb || p.city, p.state].filter(Boolean).join(', ') || 'Anywhere (telehealth)';

export default function AdminPractitionersPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['admin-practitioners-pending'],
    queryFn: () => wellnessApi.pendingPractitioners(),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Pending[]) : []),
  });

  const decide = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'verify' | 'hide' }) =>
      wellnessApi.verifyPractitioner(id, next === 'verify' ? { isVerified: true } : { isVerified: false, isActive: false }),
    onSuccess: (_r, { next }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-practitioners-pending'] });
      setSelectedId(null);
      toast.success(next === 'verify' ? 'Verified. She is in Find care now, and has been told.' : 'Hidden. She has been told to check her practice page.');
    },
    onError: (e) => toast.error(wellnessError(e, 'Could not record that')),
  });

  const current = list.data?.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Stethoscope className="h-7 w-7 text-primary-600" /> Practitioners to verify
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Check the name and AHPRA number on the public register before verifying. Kinds AHPRA does not register (counsellors, doulas, lactation consultants) are checked with their professional body.
        </p>
      </div>

      <div className={cn('grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_380px]' : 'grid-cols-1')}>
        <div>
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : list.isError ? (
            <div className="card p-10 text-center text-slate-500">Could not load the queue. {wellnessError(list.error, '')}</div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <div className="card p-10 text-center text-slate-500">Nobody waiting.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {list.data!.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setSelectedId(p.id)} className={cn('flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === p.id && 'bg-primary-50 dark:bg-primary-900/20')}>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{p.kindLabel}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">{p.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {where(p)} · {p.ahpraNumber ? `AHPRA ${p.ahpraNumber}` : 'no AHPRA number given'} · {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {current && (
          <aside className="card relative h-fit space-y-4 lg:sticky lg:top-6">
            <button type="button" onClick={() => setSelectedId(null)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{current.kindLabel}</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{current.name}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{current.headline}</p>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">AHPRA number</dt>
                <dd className="text-slate-800 dark:text-slate-200">
                  {current.ahpraNumber ? (
                    <>
                      <span className="font-mono">{current.ahpraNumber}</span>{' '}
                      <a href={AHPRA_REGISTER} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                        Check on the register
                      </a>
                    </>
                  ) : (
                    <>
                      Not given.{' '}
                      <a href={AHPRA_REGISTER} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                        Search the register by name
                      </a>
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Qualifications</dt>
                <dd className="text-slate-800 dark:text-slate-200">{current.qualifications.length ? current.qualifications.join(', ') : 'None listed'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Where</dt>
                <dd className="text-slate-800 dark:text-slate-200">
                  {where(current)}
                  {current.telehealth ? ' · telehealth' : ''}
                  {current.inPerson ? ' · in person' : ''}
                </dd>
              </div>
              {current.website && (
                <div>
                  <dt className="text-xs text-slate-500">Website</dt>
                  <dd className="break-words">
                    <a href={current.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                      {current.website}
                    </a>
                  </dd>
                </div>
              )}
              {current.owner && (
                <div>
                  <dt className="text-xs text-slate-500">Listed by</dt>
                  <dd className="text-slate-800 dark:text-slate-200">
                    <Link href={`/profile/${current.owner.id}`} className="hover:underline">
                      {current.owner.name}
                    </Link>{' '}
                    <span className="text-xs text-slate-500">{current.owner.email}</span>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-500">About</dt>
                <dd className="whitespace-pre-line text-slate-700 dark:text-slate-300">{current.bio}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => decide.mutate({ id: current.id, next: 'verify' })} disabled={decide.isPending} className="btn-primary text-sm">
                Verify
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Hide ${current.name}? The profile leaves the queue and she is told to check her practice page.`)) decide.mutate({ id: current.id, next: 'hide' });
                }}
                disabled={decide.isPending}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Hide
              </button>
              <Link href={`/dashboard/wellness/practitioners/${current.slug}`} className="text-sm text-slate-500 hover:underline">
                Open the profile
              </Link>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

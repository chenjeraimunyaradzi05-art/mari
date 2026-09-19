'use client';

/**
 * Vendor listings waiting to be verified. A member who registers her
 * business at /dashboard/vendors lands here; nothing shows in the public
 * directory until a person has checked the business against the ABN Lookup
 * and its website. Verify lists it; Verify as partner adds the partner
 * badge; Hide keeps it out. She is told either way.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Store, X } from 'lucide-react';
import { businessApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Pending = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  services: string[];
  priceRange: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  createdAt: string;
  owner: { id: string; firstName: string | null; lastName: string | null; displayName: string | null; email: string } | null;
};

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ?? (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
const nameOf = (u: NonNullable<Pending['owner']>) => u.displayName?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
const label = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
const withProtocol = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const abnLookup = (name: string) => `https://abr.business.gov.au/Search/ResultsActive?SearchText=${encodeURIComponent(name)}`;

export default function AdminVendorsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['admin-vendors-pending'],
    queryFn: () => businessApi.getPendingVendors(),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Pending[]) : []),
  });

  const decide = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'verify' | 'partner' | 'hide' }) =>
      businessApi.verifyVendor(id, next === 'hide' ? { isVerified: false } : { isVerified: true, isPartner: next === 'partner' }),
    onSuccess: (_r, { next }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors-pending'] });
      setSelectedId(null);
      toast.success(next === 'hide' ? 'Kept out of the directory. The owner has been told.' : next === 'partner' ? 'Listed as a partner. The owner has been told.' : 'Listed. The owner has been told.');
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not record that'),
  });

  const current = list.data?.find((v) => v.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Store className="h-7 w-7 text-primary-600" /> Vendors to verify
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Look the business up on the ABN Lookup and open its website before listing it. Nothing here is public until you say so.
        </p>
      </div>

      <div className={cn('grid gap-6', current ? 'lg:grid-cols-[minmax(0,1fr)_380px]' : 'grid-cols-1')}>
        <div>
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : list.isError ? (
            <div className="card p-10 text-center text-slate-500">Could not load the queue. {errorMessage(list.error) ?? ''}</div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <div className="card p-10 text-center text-slate-500">Nothing waiting.</div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {list.data!.map((v) => (
                <li key={v.id}>
                  <button type="button" onClick={() => setSelectedId(v.id)} className={cn('flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === v.id && 'bg-primary-50 dark:bg-primary-900/20')}>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{label(v.category)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">{v.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {v.location || 'No location given'} · {v.website || 'no website'} · {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label(current.category)}</p>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{current.name}</h2>
              {current.location && <p className="text-xs text-slate-500">{current.location}</p>}
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Check</dt>
                <dd className="flex flex-wrap gap-x-3 gap-y-1">
                  <a href={abnLookup(current.name)} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                    ABN Lookup
                  </a>
                  {current.website ? (
                    <a href={withProtocol(current.website)} target="_blank" rel="noopener noreferrer" className="break-all text-primary-600 hover:underline">
                      {current.website}
                    </a>
                  ) : (
                    <span className="text-slate-500">No website given</span>
                  )}
                </dd>
              </div>
              {(current.email || current.phone) && (
                <div>
                  <dt className="text-xs text-slate-500">Contact</dt>
                  <dd className="text-slate-800 dark:text-slate-200">{[current.email, current.phone].filter(Boolean).join(' · ')}</dd>
                </div>
              )}
              {current.owner && (
                <div>
                  <dt className="text-xs text-slate-500">Registered by</dt>
                  <dd className="text-slate-800 dark:text-slate-200">
                    <Link href={`/profile/${current.owner.id}`} className="hover:underline">
                      {nameOf(current.owner)}
                    </Link>{' '}
                    <span className="text-xs text-slate-500">{current.owner.email}</span>
                  </dd>
                </div>
              )}
              {current.services.length > 0 && (
                <div>
                  <dt className="text-xs text-slate-500">Services</dt>
                  <dd className="text-slate-800 dark:text-slate-200">{current.services.join(', ')}</dd>
                </div>
              )}
              {current.priceRange && (
                <div>
                  <dt className="text-xs text-slate-500">Pricing</dt>
                  <dd className="text-slate-800 dark:text-slate-200">{current.priceRange}</dd>
                </div>
              )}
              {current.description && (
                <div>
                  <dt className="text-xs text-slate-500">About</dt>
                  <dd className="whitespace-pre-line text-slate-700 dark:text-slate-300">{current.description}</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => decide.mutate({ id: current.id, next: 'verify' })} disabled={decide.isPending} className="btn-primary text-sm">
                Verify
              </button>
              <button type="button" onClick={() => decide.mutate({ id: current.id, next: 'partner' })} disabled={decide.isPending} className="btn-secondary text-sm">
                Verify as partner
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Keep ${current.name} out of the directory? The owner is told and can still edit the listing.`)) decide.mutate({ id: current.id, next: 'hide' });
                }}
                disabled={decide.isPending}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Hide
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

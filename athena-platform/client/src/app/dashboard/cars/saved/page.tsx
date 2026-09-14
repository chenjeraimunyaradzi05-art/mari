'use client';

/**
 * The listings she is watching.
 */

import Link from 'next/link';
import toast from 'react-hot-toast';
import { Heart } from 'lucide-react';
import { autoApi, autoError, aud0, km, type ListingCard } from '@/lib/automotive-api';
import { AutoNav, Empty, ErrorBox, Loading, PageTitle, StatusChip, VerdictChip, useLoad } from '@/components/automotive/AutoUi';

export default function SavedCarsPage() {
  const data = useLoad<ListingCard[]>(() => autoApi.savedListings());
  const unsave = async (id: string) => { try { await autoApi.unsaveListing(id); data.reload(); } catch (err) { toast.error(autoError(err, 'That did not work.')); } };
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Heart} kicker="Cars" title="Saved cars" blurb="The pre-loved listings you are watching. A sold or withdrawn car stays here so you know." action={<Link href="/cars/preloved" className="btn-primary text-sm">Browse pre-loved</Link>} />
      <AutoNav current="/dashboard/cars/saved" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && data.data.length === 0 && <Empty title="Nothing saved" body="Save a listing from the pre-loved pages and it waits here." action={<Link href="/cars/preloved" className="btn-primary text-sm">Browse</Link>} />}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data.data ?? []).map((l) => (
          <li key={l.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <Link href={`/cars/preloved/${l.id}`} className="block">{l.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.photos[0]} alt="" className="aspect-[4/3] w-full object-cover" />) : <div className="aspect-[4/3] w-full bg-gradient-to-br from-rose-100 via-purple-50 to-amber-50 dark:from-rose-900/20 dark:via-purple-900/10 dark:to-amber-900/10" />}</Link>
            <div className="p-4"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900 dark:text-white">{aud0(l.price)}</span><span className="flex gap-1"><VerdictChip verdict={l.priceVerdict} /><StatusChip status={l.status} /></span></div><Link href={`/cars/preloved/${l.id}`} className="mt-1 block text-sm font-medium text-slate-900 hover:text-rose-600 dark:text-white">{l.year} {l.make} {l.model}</Link><p className="text-xs text-slate-500">{km(l.odometerKm)} · {[l.suburb || l.city, l.state].filter(Boolean).join(', ')}</p><button type="button" onClick={() => unsave(l.id)} className="mt-2 text-xs text-slate-500 hover:text-rose-600">Stop watching</button></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

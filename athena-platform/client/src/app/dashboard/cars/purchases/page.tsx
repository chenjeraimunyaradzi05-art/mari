'use client';

/**
 * Offers and purchases, buying and selling, each with its state, where
 * the money is, and the next step in plain words.
 */

import Link from 'next/link';
import { Car } from 'lucide-react';
import { autoApi, aud0, type PurchaseCard } from '@/lib/automotive-api';
import { AutoNav, Empty, ErrorBox, Loading, PageTitle, StatusChip, fmtDay, useLoad } from '@/components/automotive/AutoUi';

function List({ title, items, empty }: { title: string; items: PurchaseCard[]; empty: string }) {
  return (
    <section>
      <h2 className="rail-title">{title}</h2>
      {items.length === 0 ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : (
        <ul className="mt-3 space-y-2">
          {items.map((p) => (
            <li key={p.id}><Link href={`/dashboard/cars/purchases/${p.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-rose-300 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-slate-900 dark:text-white">{p.listing.title}</span><StatusChip status={p.status} /></div>
              <p className="mt-1 text-xs text-slate-500">{aud0(p.agreedAmount ?? p.offerAmount)} · {p.role === 'buyer' ? `seller ${p.seller.name}` : `buyer ${p.buyer.name}`} · {fmtDay(p.createdAt)}{p.status === 'HANDED_OVER' && p.daysLeft !== null ? ` · ${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left in the inspection period` : ''}</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{p.nextStep}</p>
            </Link></li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PurchasesPage() {
  const data = useLoad<{ buying: PurchaseCard[]; selling: PurchaseCard[] }>(() => autoApi.purchases());
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Car} kicker="Cars" title="Offers and purchases" blurb="Every step of buying or selling a car here, and where the money is at each one." action={<Link href="/cars/preloved" className="btn-ghost text-sm">Browse pre-loved</Link>} />
      <AutoNav current="/dashboard/cars/purchases" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && data.data.buying.length === 0 && data.data.selling.length === 0 && <Empty title="Nothing yet" body="Make an offer on a pre-loved car, or list one, and it appears here with every step laid out." action={<Link href="/cars/preloved" className="btn-primary text-sm">Browse pre-loved cars</Link>} />}
      {data.data && (data.data.buying.length > 0 || data.data.selling.length > 0) && <div className="grid gap-8 lg:grid-cols-2"><List title="Buying" items={data.data.buying} empty="No offers made." /><List title="Selling" items={data.data.selling} empty="No offers received." /></div>}
    </div>
  );
}

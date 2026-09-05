'use client';

/**
 * Orders on the skills marketplace, both ways round: what you have bought and
 * what you are delivering. The lifecycle routes have existed since the
 * marketplace was built; this is the first screen that shows them.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Loader2, Package, ShoppingBag } from 'lucide-react';
import { skillsMarketplaceApi } from '@/lib/api-extensions';
import { formatAud } from '@/components/skills-marketplace/types';
import { cn } from '@/lib/utils';

type OrderStatus = 'PENDING' | 'ACCEPTED' | 'DELIVERED' | 'REVISION_REQUESTED' | 'COMPLETED' | 'CANCELLED';
type Escrow = { status: string; amount: number; currency: string; paymentIntentId: string | null } | null;

interface OrderRow {
  id: string;
  status: OrderStatus;
  packageName: string | null;
  totalAmount: number;
  providerPayout: number;
  dueAt: string | null;
  createdAt: string;
  escrow: Escrow;
  service: { id: string; title: string; category?: string; provider?: { id: string; displayName: string | null; avatar: string | null } };
  client?: { id: string; displayName: string | null; avatar: string | null };
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Waiting for provider', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
  ACCEPTED: { label: 'In progress', tone: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' },
  DELIVERED: { label: 'Delivered', tone: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200' },
  REVISION_REQUESTED: { label: 'Revision requested', tone: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' },
  COMPLETED: { label: 'Completed', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

/** The money in one phrase, from either side. */
export function paymentLabel(escrow: Escrow, viewer: 'buyer' | 'seller'): { label: string; tone: string } {
  if (!escrow) return { label: 'No payment on file', tone: 'text-slate-500' };
  const mockHeld = escrow.status === 'PENDING' && Boolean(escrow.paymentIntentId?.startsWith('pi_mock_'));
  switch (escrow.status) {
    case 'AUTHORIZED':
      return { label: viewer === 'buyer' ? 'Held on your card' : 'Payment held', tone: 'text-blue-700 dark:text-blue-300' };
    case 'CAPTURED':
      return { label: viewer === 'buyer' ? 'Paid' : 'Released to you', tone: 'text-emerald-700 dark:text-emerald-300' };
    case 'REFUNDED':
      return { label: 'Refunded', tone: 'text-slate-500' };
    case 'CANCELED':
      return { label: 'Hold released', tone: 'text-slate-500' };
    case 'FAILED':
      return { label: 'Payment failed', tone: 'text-red-600' };
    default:
      return mockHeld
        ? { label: 'Payment held', tone: 'text-blue-700 dark:text-blue-300' }
        : { label: viewer === 'buyer' ? 'Awaiting your payment' : 'Awaiting payment', tone: 'text-amber-700 dark:text-amber-300' };
  }
}

const FILTERS: Array<['all' | OrderStatus, string]> = [
  ['all', 'All'],
  ['PENDING', 'Waiting'],
  ['ACCEPTED', 'In progress'],
  ['DELIVERED', 'Delivered'],
  ['REVISION_REQUESTED', 'Revision'],
  ['COMPLETED', 'Completed'],
  ['CANCELLED', 'Cancelled'],
];

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const side: 'buying' | 'selling' = searchParams.get('tab') === 'selling' ? 'selling' : 'buying';
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');

  const orders = useQuery({
    queryKey: ['marketplace-orders', side, filter],
    queryFn: () =>
      side === 'buying'
        ? skillsMarketplaceApi.getMyOrders(filter === 'all' ? undefined : { status: filter })
        : skillsMarketplaceApi.getReceivedOrders(filter === 'all' ? undefined : { status: filter }),
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as OrderRow[]) : []),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/skills-marketplace" className="mb-6 inline-flex items-center text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        <ArrowLeft className="mr-2 h-4 w-4" /> Skills marketplace
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <ShoppingBag className="h-7 w-7 text-rose-500" /> Orders
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">The buyer's money is held when the order is placed and released when they approve the work.</p>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Side">
          {(
            [
              ['buying', 'Buying'],
              ['selling', 'Selling'],
            ] as Array<['buying' | 'selling', string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={side === value}
              onClick={() => router.replace(value === 'buying' ? '/skills-marketplace/orders' : '/skills-marketplace/orders?tab=selling')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium',
                side === value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              filter === value
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {orders.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : orders.isError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900">Could not load your orders.</div>
      ) : (orders.data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-900 dark:text-white">{side === 'buying' ? 'Nothing ordered yet' : 'No orders received yet'}</p>
          <p className="mt-1 text-sm text-slate-500">
            {side === 'buying' ? (
              <>
                Browse the{' '}
                <Link href="/skills-marketplace" className="text-primary-600 hover:underline">
                  marketplace
                </Link>{' '}
                and order a package.
              </>
            ) : (
              'When someone orders one of your packages, it appears here.'
            )}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
          {orders.data!.map((order) => {
            const status = ORDER_STATUS[order.status] ?? ORDER_STATUS.PENDING;
            const payment = paymentLabel(order.escrow, side === 'buying' ? 'buyer' : 'seller');
            const counterpart = side === 'buying' ? order.service.provider?.displayName : order.client?.displayName;
            return (
              <li key={order.id}>
                <Link href={`/skills-marketplace/orders/${order.id}`} className="flex flex-wrap items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-white">
                      {order.service.title}
                      {order.packageName && <span className="text-slate-500"> · {order.packageName}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {counterpart ? `${side === 'buying' ? 'From' : 'For'} ${counterpart} · ` : ''}
                      placed {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                      {order.dueAt && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && ` · due ${formatDistanceToNow(new Date(order.dueAt), { addSuffix: true })}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900 dark:text-white">{formatAud(side === 'buying' ? order.totalAmount : order.providerPayout)}</p>
                    <p className={cn('text-xs', payment.tone)}>{payment.label}</p>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.tone)}>{status.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

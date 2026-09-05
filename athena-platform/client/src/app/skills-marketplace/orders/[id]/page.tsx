'use client';

/**
 * One marketplace order, from either side. The brief and the handover on the
 * left; the money and what each person can do next on the right. Buyers
 * approve a delivery to release the hold, send it back for revision, or
 * cancel; providers accept once the money is held, deliver, or cancel.
 */

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, Loader2, Lock, Paperclip, Star } from 'lucide-react';
import { skillsMarketplaceApi } from '@/lib/api-extensions';
import { formatAud } from '@/components/skills-marketplace/types';
import { PaymentIntentForm } from '@/components/payments/PaymentIntentForm';
import { stripeConfigured } from '@/lib/stripe';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ORDER_STATUS, paymentLabel } from '../page';

type OrderStatus = keyof typeof ORDER_STATUS;

interface Order {
  id: string;
  status: OrderStatus;
  packageName: string | null;
  requirements: string | null;
  attachments: string[];
  totalAmount: number;
  platformFee: number;
  providerPayout: number;
  deliveryDays: number | null;
  dueAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  deliveryMessage: string | null;
  revisionReason: string | null;
  cancellationReason: string | null;
  createdAt: string;
  viewerRole: 'client' | 'provider' | null;
  service: { id: string; title: string; providerId: string };
  client: { id: string; displayName: string | null; avatar: string | null };
  escrow: { id: string; status: string; amount: number; currency: string; paymentIntentId: string | null; capturedAt: string | null; canceledAt: string | null } | null;
}

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [paying, setPaying] = useState<{ clientSecret: string; amount: number } | null>(null);

  const order = useQuery({
    queryKey: ['marketplace-order', id],
    queryFn: () => skillsMarketplaceApi.getOrder(id),
    select: (response) => response.data?.data as Order,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['marketplace-order', id] });
    queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
  };

  const act = useMutation({
    mutationFn: ({ action, payload }: { action: 'accept' | 'deliver' | 'revision' | 'complete' | 'cancel' | 'review'; payload?: Record<string, unknown> }) => {
      switch (action) {
        case 'accept':
          return skillsMarketplaceApi.acceptOrder(id);
        case 'deliver':
          return skillsMarketplaceApi.deliverOrder(id, { message: String(payload?.message ?? '') });
        case 'revision':
          return skillsMarketplaceApi.requestRevision(id, String(payload?.reason ?? ''));
        case 'complete':
          return skillsMarketplaceApi.completeOrder(id);
        case 'cancel':
          return skillsMarketplaceApi.cancelOrder(id, String(payload?.reason ?? ''));
        case 'review':
          return skillsMarketplaceApi.leaveReview(id, { rating: Number(payload?.rating), review: String(payload?.review ?? '') });
      }
    },
    onSuccess: (_res, { action }) => {
      refresh();
      setNote('');
      const said: Record<string, string> = {
        accept: 'Order accepted. The clock is running.',
        deliver: 'Delivered. The buyer has been asked to approve it.',
        revision: 'Sent back for revision.',
        complete: 'Approved. The payment has been released to the provider.',
        cancel: 'Order cancelled. The hold is released.',
        review: 'Thanks for the review.',
      };
      toast.success(said[action]);
    },
    onError: (error) => toast.error(errorMessage(error) || 'That did not go through'),
  });

  const startPayment = async () => {
    try {
      const res = await skillsMarketplaceApi.getOrderPayment(id);
      const data = res.data?.data as { status: string; clientSecret: string | null; amount: number };
      if (!data.clientSecret) {
        toast.error(data.status === 'PENDING' ? 'The payment cannot be resumed right now.' : 'This order is already paid or closed.');
        refresh();
        return;
      }
      setPaying({ clientSecret: data.clientSecret, amount: data.amount });
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not start the payment');
    }
  };

  if (order.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    );
  }
  if (order.isError || !order.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-lg font-medium text-slate-900 dark:text-white">This order is not yours to see, or does not exist.</p>
        <Link href="/skills-marketplace/orders" className="mt-4 inline-block text-primary-600 hover:underline">
          Back to orders
        </Link>
      </div>
    );
  }

  const o = order.data;
  const isBuyer = o.viewerRole === 'client';
  const isProvider = o.viewerRole === 'provider';
  const status = ORDER_STATUS[o.status] ?? ORDER_STATUS.PENDING;
  const payment = paymentLabel(o.escrow, isBuyer ? 'buyer' : 'seller');
  const mockHeld = o.escrow?.status === 'PENDING' && Boolean(o.escrow.paymentIntentId?.startsWith('pi_mock_'));
  const held = o.escrow?.status === 'AUTHORIZED' || o.escrow?.status === 'CAPTURED' || mockHeld;
  const needsPayment = isBuyer && o.escrow?.status === 'PENDING' && !mockHeld && o.status === 'PENDING';
  const busy = act.isPending;

  const timeline: Array<[string, string | null]> = [
    ['Placed', o.createdAt],
    ['Due', o.status === 'CANCELLED' ? null : o.dueAt],
    ['Delivered', o.deliveredAt],
    ['Completed', o.completedAt],
    ['Cancelled', o.cancelledAt],
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/skills-marketplace/orders${isProvider ? '?tab=selling' : ''}`} className="mb-6 inline-flex items-center text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        <ArrowLeft className="mr-2 h-4 w-4" /> Orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isProvider ? 'Order for you to deliver' : 'Your order'}</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            <Link href={`/skills-marketplace/${o.service.id}`} className="hover:underline">
              {o.service.title}
            </Link>
            {o.packageName && <span className="font-normal text-slate-500"> · {o.packageName}</span>}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isProvider ? `Ordered by ${o.client.displayName || 'a member'}` : 'Placed'} {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
          </p>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-sm font-medium', status.tone)}>{status.label}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-2 font-semibold text-slate-900 dark:text-white">The brief</h2>
            {o.requirements ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{o.requirements}</p>
            ) : (
              <p className="text-sm text-slate-500">The buyer did not add any notes.</p>
            )}
            {o.attachments.length > 0 && (
              <ul className="mt-3 space-y-1">
                {o.attachments.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
                      <Paperclip className="h-3.5 w-3.5" /> {url.split('/').pop()}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(o.deliveryMessage || o.revisionReason || o.cancellationReason) && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="mb-2 font-semibold text-slate-900 dark:text-white">The handover</h2>
              <dl className="space-y-3 text-sm">
                {o.deliveryMessage && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Provider, on delivery</dt>
                    <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{o.deliveryMessage}</dd>
                  </div>
                )}
                {o.revisionReason && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">Buyer, asking for a revision</dt>
                    <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{o.revisionReason}</dd>
                  </div>
                )}
                {o.cancellationReason && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">On cancelling</dt>
                    <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{o.cancellationReason}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Timeline</h2>
            <ol className="space-y-2 text-sm">
              {timeline
                .filter(([, when]) => when)
                .map(([label, when]) => (
                  <li key={label} className="flex items-center justify-between">
                    <span className="text-slate-700 dark:text-slate-300">{label}</span>
                    <span className="text-slate-500">{format(new Date(when!), 'd MMM yyyy, h:mm a')}</span>
                  </li>
                ))}
              {o.deliveryDays && o.status !== 'CANCELLED' && (
                <li className="text-xs text-slate-500">{o.deliveryDays}-day delivery, counted from acceptance.</li>
              )}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Lock className="h-4 w-4 text-slate-400" /> Payment
            </h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Order total</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{formatAud(o.totalAmount)}</dd>
              </div>
              {isProvider && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Platform fee</dt>
                    <dd className="text-slate-700 dark:text-slate-300">− {formatAud(o.platformFee)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1.5 dark:border-slate-800">
                    <dt className="text-slate-500">You receive</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">{formatAud(o.providerPayout)}</dd>
                  </div>
                </>
              )}
            </dl>
            <p className={cn('mt-3 text-sm font-medium', payment.tone)}>{payment.label}</p>
            <p className="mt-1 text-xs text-slate-500">
              {o.escrow?.status === 'CAPTURED'
                ? 'Released when the buyer approved the delivery.'
                : held
                  ? 'Held on the buyer’s card and released only when they approve the work.'
                  : o.escrow?.status === 'CANCELED' || o.escrow?.status === 'REFUNDED'
                    ? 'Nothing was taken.'
                    : isBuyer
                      ? 'The provider cannot start until the hold is authorised.'
                      : 'The buyer has not yet authorised the hold.'}
            </p>
            {needsPayment && !paying && stripeConfigured && (
              <Button className="mt-3 w-full" onClick={() => void startPayment()}>
                Authorise {formatAud(o.totalAmount)}
              </Button>
            )}
            {paying && (
              <div className="mt-3">
                <PaymentIntentForm
                  clientSecret={paying.clientSecret}
                  amountLabel={formatAud(paying.amount / 100)}
                  onAuthorised={() => {
                    setPaying(null);
                    toast.success('Held. The provider has been told.');
                    refresh();
                  }}
                  onSkip={() => setPaying(null)}
                  skipLabel="Not now"
                />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Next</h2>

            {isProvider && o.status === 'PENDING' && (
              <div className="space-y-2">
                <Button className="w-full" disabled={busy || !held} onClick={() => act.mutate({ action: 'accept' })}>
                  Accept order
                </Button>
                {!held && <p className="text-xs text-slate-500">You can accept once the buyer’s payment is held.</p>}
                <CancelButton busy={busy} onCancel={(reason) => act.mutate({ action: 'cancel', payload: { reason } })} label="Decline" />
              </div>
            )}

            {isProvider && (o.status === 'ACCEPTED' || o.status === 'REVISION_REQUESTED') && (
              <div className="space-y-2">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={5000} placeholder="What you delivered, where to find it, anything the buyer should know" aria-label="Delivery message" className="input w-full text-sm" />
                <Button className="w-full" disabled={busy} onClick={() => act.mutate({ action: 'deliver', payload: { message: note } })}>
                  Mark as delivered
                </Button>
                <CancelButton busy={busy} onCancel={(reason) => act.mutate({ action: 'cancel', payload: { reason } })} />
              </div>
            )}

            {isProvider && o.status === 'DELIVERED' && <p className="text-sm text-slate-500">Waiting for the buyer to approve the delivery. Approval releases the payment to you.</p>}

            {isBuyer && (o.status === 'PENDING' || o.status === 'ACCEPTED' || o.status === 'REVISION_REQUESTED') && (
              <div className="space-y-2">
                <p className="text-sm text-slate-500">
                  {o.status === 'PENDING' ? 'Waiting for the provider to accept.' : 'The provider is working on it.'}
                </p>
                <CancelButton busy={busy} onCancel={(reason) => act.mutate({ action: 'cancel', payload: { reason } })} />
              </div>
            )}

            {isBuyer && o.status === 'DELIVERED' && (
              <div className="space-y-3">
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Approve the delivery and release ${formatAud(o.totalAmount)} to the provider?`)) act.mutate({ action: 'complete' });
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve and release payment
                </Button>
                <div className="space-y-2">
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} placeholder="What needs to change" aria-label="Revision reason" className="input w-full text-sm" />
                  <Button variant="outline" className="w-full" disabled={busy || !note.trim()} onClick={() => act.mutate({ action: 'revision', payload: { reason: note.trim() } })}>
                    Request a revision
                  </Button>
                </div>
              </div>
            )}

            {isBuyer && o.status === 'COMPLETED' && (
              <div className="space-y-2">
                <p className="text-sm text-slate-700 dark:text-slate-300">How did it go?</p>
                <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setRating(n)} className="p-0.5">
                      <Star className={cn('h-6 w-6', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
                    </button>
                  ))}
                </div>
                <textarea value={review} onChange={(e) => setReview(e.target.value)} rows={3} maxLength={5000} placeholder="A line or two for the next buyer" aria-label="Review" className="input w-full text-sm" />
                <Button className="w-full" disabled={busy} onClick={() => act.mutate({ action: 'review', payload: { rating, review } })}>
                  Leave review
                </Button>
              </div>
            )}

            {o.status === 'CANCELLED' && <p className="text-sm text-slate-500">This order was cancelled.</p>}
            {isProvider && o.status === 'COMPLETED' && <p className="text-sm text-slate-500">Done. The payment has been released to you.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

function CancelButton({ busy, onCancel, label = 'Cancel order' }: { busy: boolean; onCancel: (reason: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open) {
    return (
      <button type="button" disabled={busy} onClick={() => setOpen(true)} className="w-full text-center text-sm text-red-600 hover:text-red-700">
        {label}
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-red-100 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-900/10">
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={2000} placeholder="Why (the other person sees this)" aria-label="Cancellation reason" className="input w-full text-sm" />
      <div className="flex gap-2">
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => onCancel(reason.trim())}>
          {label}, release the hold
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}

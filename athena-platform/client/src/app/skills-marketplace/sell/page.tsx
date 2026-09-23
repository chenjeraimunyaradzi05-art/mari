'use client';

/**
 * A seller's own listings.
 *
 * The marketplace has had a complete buying side for months — browse, book by
 * the hour, order a package, escrow, delivery, reviews — and no way whatsoever
 * to list a service, on a page linked from the home directory, the footer and
 * the sitemap. `GET /services/me`, `POST /services`, `PATCH /services/:id` and
 * the archiving `DELETE` were all built and never called from anywhere. This
 * screen is the missing half.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Loader2, Pencil, Plus, Sparkles, Store } from 'lucide-react';
import { apiMessage } from '@/lib/strategy-api';
import { categoryLabel, formatAud, readPackages } from '@/components/skills-marketplace/types';
import { sellerApi, type SellerService, type SellerServiceStatus } from '@/lib/skills-marketplace-seller';
import { BackToHome, EmptyState, PageShell } from '@/components/layout/PageShell';
import { cn } from '@/lib/utils';

const TONE: Record<SellerServiceStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  PAUSED: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
  ARCHIVED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_WORD: Record<SellerServiceStatus, string> = {
  ACTIVE: 'live',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
};

export default function SellerListingsPage() {
  const [services, setServices] = useState<SellerService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sellerApi.listMine();
      setServices(res.data?.data ?? []);
      setError(null);
    } catch (err) {
      setError(apiMessage(err, 'Your listings could not be loaded.'));
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (service: SellerService, status: SellerServiceStatus, said: string) => {
    setBusyId(service.id);
    try {
      // Pausing hides the listing two ways at once: `status` keeps it out of the
      // browse query and `isAvailable` keeps it from being ordered directly.
      await sellerApi.update(service.id, {
        status,
        isAvailable: status === 'ACTIVE',
      });
      await load();
      toast.success(said);
    } catch (err) {
      toast.error(apiMessage(err, 'That could not be changed.'));
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (service: SellerService) => {
    setBusyId(service.id);
    try {
      await sellerApi.archive(service.id);
      await load();
      toast.success('Archived. Your past orders and reviews are untouched.');
    } catch (err) {
      toast.error(apiMessage(err, 'That listing could not be archived.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell width="default" showBack={false}>
      <BackToHome href="/skills-marketplace" label="Back to the marketplace" />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Store className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Selling</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">
            What you are offering
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Sell your time by the hour, a fixed piece of work, or both. Money moves through Stripe and
            is only released when the work is done.
          </p>
        </div>
        <Link href="/skills-marketplace/sell/new" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5">
          <Plus className="h-4 w-4" /> List a service
        </Link>
      </header>

      <p className="mb-5 text-sm text-slate-600 dark:text-slate-400">
        Work you have sold shows up under{' '}
        <Link href="/skills-marketplace/orders" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
          orders
        </Link>{' '}
        and{' '}
        <Link href="/skills-marketplace/bookings" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
          bookings
        </Link>
        . Payouts are set up on your{' '}
        <Link href="/dashboard/earnings" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
          earnings page
        </Link>
        {' '}— without them, nobody can pay you.
      </p>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : error ? (
        <p className="surface p-6 text-sm text-slate-600 dark:text-slate-300">{error}</p>
      ) : services.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          reason="empty"
          title="You have not listed anything yet"
          description="Name the thing you are good at, set a rate, and you are open for work. It takes a couple of minutes and you can pause it whenever you like."
          primaryAction={{ label: 'List a service', href: '/skills-marketplace/sell/new' }}
          secondaryAction={{ label: 'See what others offer', href: '/skills-marketplace' }}
        />
      ) : (
        <ul className="space-y-3">
          {services.map((service) => {
            const packages = readPackages(service.packages);
            const counts = service._count;
            const busy = busyId === service.id;

            return (
              <li key={service.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/skills-marketplace/${service.id}`}
                      className="font-semibold text-slate-900 hover:underline dark:text-white"
                    >
                      {service.title}
                    </Link>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                      {categoryLabel(service.category)} · {formatAud(service.hourlyRate)} an hour
                      {service.minimumHours > 1 ? ` · ${service.minimumHours} hr minimum` : ''}
                      {packages.length > 0
                        ? ` · ${packages.length} package${packages.length === 1 ? '' : 's'} from ${formatAud(
                            Math.min(...packages.map((p) => p.price))
                          )}`
                        : ''}
                    </p>
                    {counts && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {counts.orders} order{counts.orders === 1 ? '' : 's'} · {counts.bookings} booking
                        {counts.bookings === 1 ? '' : 's'} · {counts.reviews} review
                        {counts.reviews === 1 ? '' : 's'} · {counts.favorites} saved
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                      TONE[service.status]
                    )}
                  >
                    {STATUS_WORD[service.status]}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/skills-marketplace/sell/${service.id}`}
                    className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </Link>

                  {service.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => setStatus(service, 'PAUSED', 'Paused. Nobody new can book it.')}
                      disabled={busy}
                      className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <EyeOff className="h-4 w-4" /> Pause
                    </button>
                  )}

                  {service.status !== 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => setStatus(service, 'ACTIVE', 'Back on the marketplace.')}
                      disabled={busy}
                      className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                    >
                      <Eye className="h-4 w-4" /> {service.status === 'PAUSED' ? 'Unpause' : 'Relist'}
                    </button>
                  )}

                  {service.status !== 'ARCHIVED' && (
                    <button
                      type="button"
                      onClick={() => archive(service)}
                      disabled={busy}
                      className="btn-ghost px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}

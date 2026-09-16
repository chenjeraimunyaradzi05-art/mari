'use client';

/**
 * Buying gift points.
 *
 * Viewers could send gifts and had no way to get any points, so a balance of
 * zero was permanent and the gift buttons were dead. The server has taken
 * top-ups all along: it creates a Stripe intent carrying the points in its
 * metadata, and credits them once, idempotently, when the payment is
 * confirmed. This is the card step in between.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Coins, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { PaymentIntentForm } from '@/components/payments/PaymentIntentForm';
import { creatorApi } from '@/lib/api';
import { apiMessage } from '@/lib/strategy-api';
import { cn, formatCurrency } from '@/lib/utils';

type Started = { paymentIntentId: string; clientSecret: string | null; amount: number; giftPoints: number; currency: string };

const AMOUNTS = [5, 10, 25, 50, 100];

export function TopUpModal({ isOpen, onClose, onTopped }: { isOpen: boolean; onClose: () => void; onTopped: (points: number) => void }) {
  const [amount, setAmount] = useState(10);
  const [started, setStarted] = useState<Started | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await creatorApi.purchaseGiftBalance(amount);
      setStarted((res.data?.data ?? null) as Started | null);
    } catch (err) {
      setError(apiMessage(err, 'The top-up could not be started.'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (paymentIntentId: string) => {
    try {
      const res = await creatorApi.confirmGiftPurchase(paymentIntentId);
      const points = Number(res.data?.data?.giftPoints ?? started?.giftPoints ?? 0);
      toast.success(`${points} points added.`);
      onTopped(points);
      setStarted(null);
      onClose();
    } catch (err) {
      toast.error(apiMessage(err, 'The payment went through but the points have not landed yet. They will shortly.'));
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Top up your gift points">
      <div className="space-y-4">
        {!started ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Points are what gifts are sent with. Creators keep most of what a gift is worth; the rest is the platform fee.
            </p>
            <fieldset>
              <legend className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">How much</legend>
              <div className="flex flex-wrap gap-2">
                {AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(a)}
                    aria-pressed={amount === a}
                    className={cn('rounded-full px-4 py-2 text-sm font-medium transition', amount === a ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300')}
                  >
                    {formatCurrency(a)}
                  </button>
                ))}
              </div>
            </fieldset>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button className="flex-1" onClick={start} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
                {busy ? 'Starting…' : `Top up ${formatCurrency(amount)}`}
              </Button>
            </div>
          </>
        ) : started.clientSecret ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {formatCurrency(started.amount, started.currency)} for {started.giftPoints} points.
            </p>
            <PaymentIntentForm
              clientSecret={started.clientSecret}
              amountLabel={formatCurrency(started.amount, started.currency)}
              onAuthorised={() => void confirm(started.paymentIntentId)}
              onSkip={() => setStarted(null)}
              skipLabel="Choose a different amount"
            />
          </>
        ) : (
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>Card payments are not switched on for this site yet, so points cannot be bought here.</p>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

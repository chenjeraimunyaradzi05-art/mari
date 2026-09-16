'use client';

/**
 * The registration fee.
 *
 * A registration that has been submitted sits at PAYMENT_PENDING until the
 * fee is authorised. Submitting hands back the payment details with the
 * registration; an applicant who closed the tab gets them again from
 * `/payment-intent`. Once Stripe reports the card authorised, the browser
 * tells the server, which is the belt to the webhook's braces: whichever
 * arrives first advances the registration and the other is a no-op.
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react';
import { formationApi } from '@/lib/api';
import { apiMessage } from '@/lib/strategy-api';
import { PaymentIntentForm } from '@/components/payments/PaymentIntentForm';
import { formatCurrency } from '@/lib/utils';

type Payment = { paymentIntentId: string; clientSecret: string | null; amountCents: number; currency: string };

export function FormationFee({ registrationId, status, payment, onPaid }: { registrationId: string; status: string; payment?: Payment | null; onPaid: () => void }) {
  const [intent, setIntent] = useState<Payment | null>(payment ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (payment) setIntent(payment); }, [payment]);

  const awaiting = status === 'PAYMENT_PENDING' || status === 'PENDING_PAYMENT';
  const paid = ['PAYMENT_COMPLETE', 'PAID', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'COMPLETED'].includes(status);

  const fetchIntent = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await formationApi.paymentIntent(registrationId);
      setIntent(res.data?.data ?? res.data ?? null);
    } catch (err) {
      setError(apiMessage(err, 'The payment could not be started. Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  }, [registrationId]);

  useEffect(() => {
    if (awaiting && !intent) fetchIntent();
  }, [awaiting, intent, fetchIntent]);

  const confirm = async () => {
    if (!intent) return;
    try {
      await formationApi.confirmPayment(registrationId, intent.paymentIntentId);
      toast.success('Fee paid. The registration is on its way.');
      onPaid();
    } catch (err) {
      // The webhook is authoritative and may already have advanced it, so a
      // failure here is reported without pretending the money was lost.
      toast.error(apiMessage(err, 'The payment went through but the registration did not update. It will catch up shortly.'));
      onPaid();
    }
  };

  if (paid) {
    return (
      <div className="border rounded-lg p-6">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> The fee is paid.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Nothing further to pay on this registration.</p>
      </div>
    );
  }

  if (!awaiting) return null;

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-5 w-5 text-primary" /> The fee</h2>
        <p className="text-sm text-muted-foreground">
          This registration is submitted and waiting on its fee. It goes no further until the card is authorised.
        </p>
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {busy && !intent && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Preparing the payment…</p>
      )}

      {intent && intent.amountCents === 0 && (
        <p className="text-sm text-muted-foreground">There is no fee for this structure. Nothing to pay.</p>
      )}

      {intent && intent.amountCents > 0 && intent.clientSecret && (
        <PaymentIntentForm
          clientSecret={intent.clientSecret}
          amountLabel={formatCurrency(intent.amountCents / 100, intent.currency.toUpperCase())}
          onAuthorised={confirm}
          onSkip={() => setIntent(null)}
          skipLabel="Pay later"
        />
      )}

      {intent && intent.amountCents > 0 && !intent.clientSecret && (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Card payments are not switched on for this site, so the fee of {formatCurrency(intent.amountCents / 100, intent.currency.toUpperCase())} cannot be taken here yet.</p>
          <button type="button" onClick={fetchIntent} className="rounded-md border px-3 py-1.5 text-sm">Try again</button>
        </div>
      )}
    </div>
  );
}

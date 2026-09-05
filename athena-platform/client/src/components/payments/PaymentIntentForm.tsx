'use client';

/**
 * Authorises a PaymentIntent the server created with manual capture: the
 * amount is held on the card now and taken only when the server captures it
 * (for a mentoring session, when the mentor marks it complete). Card details
 * live inside Stripe's element and never reach this code.
 */

import { useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Loader2, Lock } from 'lucide-react';
import { getStripe, stripeConfigured } from '@/lib/stripe';

interface PaymentIntentFormProps {
  clientSecret: string;
  /** "$120.00", shown on the button. */
  amountLabel: string;
  onAuthorised: () => void;
  onSkip?: () => void;
  skipLabel?: string;
}

function Inner({ amountLabel, onAuthorised }: Pick<PaymentIntentFormProps, 'amountLabel' | 'onAuthorised'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setProblem(null);
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });
    if (error) {
      setProblem(error.message ?? 'The payment could not be authorised. Check the details and try again.');
      setBusy(false);
      return;
    }
    setBusy(false);
    onAuthorised();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <PaymentElement options={{ layout: 'tabs' }} />
      {problem && (
        <p className="text-sm text-red-600" role="alert">
          {problem}
        </p>
      )}
      <button type="submit" disabled={!stripe || !elements || busy} className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {busy ? 'Authorising…' : `Authorise ${amountLabel}`}
      </button>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        The amount is held on your card and charged only when the session is completed. A cancelled session releases it.
      </p>
    </form>
  );
}

export function PaymentIntentForm({ clientSecret, amountLabel, onAuthorised, onSkip, skipLabel = 'Do this later' }: PaymentIntentFormProps) {
  const stripe = getStripe();

  if (!stripeConfigured || !stripe) {
    return (
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p>Card payments are not switched on for this site yet, so the payment step is skipped for now.</p>
        {onSkip && (
          <button type="button" onClick={onSkip} className="btn-outline px-3 py-1.5 text-sm">
            Continue
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Elements stripe={stripe} options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#be185d' } } }}>
        <Inner amountLabel={amountLabel} onAuthorised={onAuthorised} />
      </Elements>
      {onSkip && (
        <button type="button" onClick={onSkip} className="w-full text-center text-xs text-slate-500 hover:underline">
          {skipLabel}
        </button>
      )}
    </div>
  );
}

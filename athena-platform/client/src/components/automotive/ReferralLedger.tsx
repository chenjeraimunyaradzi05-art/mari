'use client';

/**
 * One referral fee on the admin ledger: where it stands against the money,
 * every payment recorded against it, and the actions that move it.
 *
 * There used to be a "Paid" button here that set the status and nothing
 * else, so the ledger's "received" total was a count of clicks. A fee is now
 * paid when the payments recorded against it cover it: the button is
 * "Record a payment", which asks for what a bank statement or Stripe would
 * show — the amount, the day it arrived, how it came and its reference — and
 * the status follows. A mistaken payment is reversed with a reason and stays
 * on the fee, struck through, so the ledger reads the same tomorrow.
 *
 * Used on the automotive admin queues for the fees still open, and on the
 * full ledger page for every fee.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { autoApi, autoError, aud0, audCents, type AdminReferralCard, type PaymentMethod, type PaymentMethodWords, type ReferralPayment, type ReferralTotals } from '@/lib/automotive-api';
import { Confirm, StatusChip, fmtDay } from '@/components/automotive/AutoUi';
import { Field, NumberInput, SelectInput, inputClass, num } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

/** Today where ATHENA is. Queensland has no daylight saving, so it is UTC+10 all year; the server holds a payment day to the same clock. */
export const brisbaneToday = () => new Date(Date.now() + 10 * 3_600_000).toISOString().slice(0, 10);

/** The ledger's totals as one sentence, for the top of either ledger panel. Every figure in it is a sum of recorded payments or of fees, never of statuses. */
export function ledgerIntro(t: ReferralTotals): string {
  const parts = [`${aud0(t.pending)} pending`, `${aud0(t.confirmed)} confirmed and still owed`, `${audCents(t.paid * 100)} received and recorded against a payment`];
  const checks = t.unreconciled > 0 ? ` ${audCents(t.unreconciled * 100)} of what was received is not yet matched to a bank statement or checked with Stripe.` : '';
  const legacy = t.markedPaidUnrecorded.count > 0 ? ` ${t.markedPaidUnrecorded.count} ${t.markedPaidUnrecorded.count === 1 ? 'fee was' : 'fees were'} marked paid before payments were recorded (${aud0(t.markedPaidUnrecorded.fee)}) and ${t.markedPaidUnrecorded.count === 1 ? 'is' : 'are'} not counted as received until the payment is found and recorded.` : '';
  return `What partners owe for introductions made here: ${parts.join(', ')}.${checks}${legacy} A pending fee is confirmed once the sale, loan or policy is checked with the partner, and paid once the payments recorded against it cover it.`;
}

const REFERRAL_KINDS = [{ value: 'INSURANCE', label: 'Insurance' }, { value: 'WARRANTY', label: 'Extended warranty' }, { value: 'PARTS', label: 'Parts' }, { value: 'FINANCE', label: 'Finance' }, { value: 'DEALER_SALE', label: 'Dealership sale' }, { value: 'FLEET', label: 'Fleet programme' }];

/** A fee agreed with a partner outside the flows that record their own: an insurer, a warranty provider, a parts supplier. */
export function AddReferralFee({ onDone }: { onDone: () => void }) {
  const [add, setAdd] = useState({ kind: 'INSURANCE', partner: '', basisAmount: '', fee: '', note: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await autoApi.admin.addReferral({ kind: add.kind, partner: add.partner, basisAmount: num(add.basisAmount), fee: add.fee ? num(add.fee) : undefined, note: add.note || undefined });
      toast.success('Added to the ledger');
      setAdd({ kind: 'INSURANCE', partner: '', basisAmount: '', fee: '', note: '' });
      onDone();
    } catch (err) { toast.error(autoError(err, 'That could not be added.')); } finally { setBusy(false); }
  };
  return (
    <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add a fee agreed with a partner</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Field label="Kind"><SelectInput value={add.kind} onChange={(v) => setAdd((x) => ({ ...x, kind: v }))} options={REFERRAL_KINDS} /></Field>
        <Field label="Partner"><input value={add.partner} onChange={(e) => setAdd((x) => ({ ...x, partner: e.target.value }))} maxLength={80} className={inputClass} /></Field>
        <Field label="Basis: premium, price, loan"><NumberInput value={add.basisAmount} onChange={(v) => setAdd((x) => ({ ...x, basisAmount: v }))} prefix="$" /></Field>
        <Field label="Fee, if not the standard"><NumberInput value={add.fee} onChange={(v) => setAdd((x) => ({ ...x, fee: v }))} prefix="$" /></Field>
      </div>
      <input value={add.note} onChange={(e) => setAdd((x) => ({ ...x, note: e.target.value }))} maxLength={500} placeholder="A note: the policy, invoice or order reference" className={`${inputClass} mt-2`} />
      <button type="button" disabled={busy || !add.partner.trim() || num(add.basisAmount) <= 0} onClick={save} className="btn-primary mt-2 text-xs disabled:opacity-50">Add it as pending</button>
    </div>
  );
}

const STATE_WORDS: Record<AdminReferralCard['ledger']['state'], string> = { UNPAID: 'Nothing received yet', PART_PAID: 'Part paid', PAID: 'Paid in full', OVERPAID: 'More received than the fee' };

function RecordPayment({ referral, methods, onDone, onCancel }: { referral: AdminReferralCard; methods: PaymentMethodWords; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ amount: referral.ledger.outstandingCents > 0 ? String(referral.ledger.outstandingCents / 100) : '', receivedOn: brisbaneToday(), method: 'BANK_TRANSFER' as PaymentMethod, reference: '', note: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    setBusy(true);
    try {
      await autoApi.admin.recordReferralPayment(referral.id, { amount: num(form.amount), receivedOn: form.receivedOn, method: form.method, reference: form.reference.trim(), note: form.note.trim() || undefined });
      toast.success('Payment recorded');
      onDone();
    } catch (err) { toast.error(autoError(err, 'The payment could not be recorded.')); } finally { setBusy(false); }
  };
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-sky-200 bg-white p-3 dark:border-sky-900/40 dark:bg-slate-900">
      <p className="text-xs text-slate-600 dark:text-slate-400">Record what arrived, as the bank statement or Stripe shows it. The fee is marked paid once the payments cover it.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Amount received"><NumberInput value={form.amount} onChange={(v) => set('amount', v)} prefix="$" step={0.01} /></Field>
        <Field label="Day it arrived"><input type="date" value={form.receivedOn} max={brisbaneToday()} onChange={(e) => set('receivedOn', e.target.value)} className={inputClass} /></Field>
        <Field label="How it came"><SelectInput value={form.method} onChange={(v) => set('method', v)} options={(Object.keys(methods) as PaymentMethod[]).map((k) => ({ value: k, label: methods[k].label }))} /></Field>
        <Field label="Reference" hint={methods[form.method]?.reference}><input value={form.reference} onChange={(e) => set('reference', e.target.value)} maxLength={120} className={inputClass} /></Field>
      </div>
      <input value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={500} placeholder="A note, if it needs one: which invoice, part of a larger transfer" className={inputClass} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || num(form.amount) <= 0 || form.reference.trim().length < 3 || !form.receivedOn} onClick={save} className="btn-primary text-xs disabled:opacity-50">Record it</button>
        <button type="button" onClick={onCancel} className="btn-ghost text-xs">Cancel</button>
      </div>
    </div>
  );
}

function PaymentLine({ referralId, payment, stripeConfigured, onChanged }: { referralId: string; payment: ReferralPayment; stripeConfigured: boolean; onChanged: () => void }) {
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await fn(); toast.success(done); setReversing(false); onChanged(); } catch (err) { toast.error(autoError(err, 'That did not work.')); } finally { setBusy(false); }
  };
  const bank = payment.reconciliation?.bankLine;
  const stripeChecked = payment.reconciliation?.stripe?.checked || payment.stripe?.checked;
  const check = payment.reversal ? null
    : bank ? `Matched to the bank line of ${fmtDay(bank.date, { day: 'numeric', month: 'short', year: 'numeric' })}${payment.reconciliation?.statement ? ` in ${payment.reconciliation.statement}` : ''}`
      : stripeChecked ? 'Checked with Stripe'
        : payment.method === 'STRIPE' ? (payment.stripe && !payment.stripe.checked ? `Not checked with Stripe: ${payment.stripe.reason.toLowerCase()}` : 'Not checked with Stripe')
          : 'Not yet matched to a bank statement';
  return (
    <li className={cn('rounded-md bg-white p-2 text-xs dark:bg-slate-900', payment.reversal && 'opacity-70')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn('text-slate-800 dark:text-slate-200', payment.reversal && 'line-through')}>
          <span className="font-semibold">{audCents(payment.amountCents)}</span> · {fmtDay(payment.receivedOn, { day: 'numeric', month: 'short', year: 'numeric' })} · {payment.methodLabel} · {payment.reference}
        </span>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', payment.reversal ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : payment.reconciled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200')}>{payment.reversal ? 'Reversed' : payment.reconciled ? 'Checked' : 'Unchecked'}</span>
      </div>
      <p className="mt-1 text-slate-500">
        Recorded {fmtDay(payment.recordedAt, { day: 'numeric', month: 'short', year: 'numeric' })}{payment.recordedBy ? ` by ${payment.recordedBy}` : ''}.{check ? ` ${check}.` : ''}{payment.note ? ` ${payment.note}` : ''}
      </p>
      {payment.reversal && <p className="mt-1 text-slate-600 dark:text-slate-400">Reversed {fmtDay(payment.reversal.at, { day: 'numeric', month: 'short', year: 'numeric' })}{payment.reversal.by ? ` by ${payment.reversal.by}` : ''}: {payment.reversal.reason}</p>}
      {!payment.reversal && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {payment.method === 'STRIPE' && !payment.reconciled && stripeConfigured && <button type="button" disabled={busy} onClick={() => run(() => autoApi.admin.checkReferralPaymentWithStripe(referralId, payment.paymentId), 'Checked with Stripe')} className="rounded-md bg-sky-600 px-2 py-1 font-semibold text-white disabled:opacity-50">Check with Stripe</button>}
          {!reversing && <button type="button" onClick={() => setReversing(true)} className="text-slate-500 underline-offset-2 hover:underline">Reverse</button>}
          {reversing && (
            <span className="flex w-full flex-wrap items-center gap-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Why: recorded twice, the wrong fee, not on the statement" className={cn(inputClass, 'flex-1 text-xs')} />
              <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => run(() => autoApi.admin.reverseReferralPayment(referralId, payment.paymentId, reason.trim()), 'Reversed')} className="rounded-md bg-rose-500 px-2 py-1 font-semibold text-white disabled:opacity-50">Reverse it</button>
              <button type="button" onClick={() => setReversing(false)} className="btn-ghost text-xs">Keep it</button>
            </span>
          )}
        </div>
      )}
    </li>
  );
}

export function ReferralLedgerItem({ referral: r, methods, stripeConfigured, onChanged }: { referral: AdminReferralCard; methods: PaymentMethodWords; stripeConfigured: boolean; onChanged: () => void }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await fn(); toast.success(done); onChanged(); } catch (err) { toast.error(autoError(err, 'That did not work.')); } finally { setBusy(false); }
  };
  const l = r.ledger;
  const money = l.receivedCents > 0 || r.status !== 'VOID';
  return (
    <li className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-slate-900 dark:text-white">{r.kindLabel} · {r.partner ?? 'partner not named'} <span className="text-xs font-normal text-slate-500">· {r.member?.name ?? 'no member'} · {aud0(r.basisAmount)} at {r.feePercent}% · {fmtDay(r.createdAt)}</span></span>
        <span className="flex items-center gap-2"><span className="font-semibold text-slate-900 dark:text-white">{aud0(r.fee)}</span><StatusChip status={r.status} /></span>
      </div>
      {money && (
        <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
          {STATE_WORDS[l.state]}: {audCents(l.receivedCents)} received of {audCents(l.feeCents)}{l.outstandingCents > 0 && l.receivedCents > 0 ? `, ${audCents(l.outstandingCents)} still owed` : ''}{l.paidOn ? `, covered on ${fmtDay(l.paidOn, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
          {l.confirmedBy ? ` Confirmed ${fmtDay(l.confirmedBy.at, { day: 'numeric', month: 'short', year: 'numeric' })}${l.confirmedBy.how === 'PAYMENT' ? ' by the partner paying' : l.confirmedBy.by ? ` by ${l.confirmedBy.by}` : ''}.` : r.confirmedAt ? ` Confirmed ${fmtDay(r.confirmedAt, { day: 'numeric', month: 'short', year: 'numeric' })}.` : ''}
        </p>
      )}
      {r.note && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{r.note}</p>}
      {r.attention.length > 0 && <ul className="mt-2 space-y-1">{r.attention.map((a) => <li key={a.key} className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">{a.words}</li>)}</ul>}
      {l.payments.length > 0 && <ul className="mt-2 space-y-1">{l.payments.map((p) => <PaymentLine key={p.paymentId} referralId={r.id} payment={p} stripeConfigured={stripeConfigured} onChanged={onChanged} />)}</ul>}
      <div className="mt-2 flex flex-wrap gap-1">
        {r.status === 'PENDING' && <button type="button" disabled={busy} onClick={() => act(() => autoApi.admin.referral(r.id, { status: 'CONFIRMED' }), 'Confirmed')} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Confirmed with the partner</button>}
        {r.status === 'VOID' && <button type="button" disabled={busy} onClick={() => act(() => autoApi.admin.referral(r.id, { status: 'CONFIRMED' }), 'Restored')} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Restore: the sale was real</button>}
        {r.status !== 'VOID' && r.fee > 0 && !recording && <button type="button" disabled={busy} onClick={() => setRecording(true)} className="rounded-md bg-sky-500 px-2 py-1 text-xs font-semibold text-white">Record a payment</button>}
        {r.status !== 'VOID' && l.receivedCents === 0 && <Confirm label="Void" tone="slate" hint="It will not be billed." onConfirm={() => act(() => autoApi.admin.referral(r.id, { status: 'VOID' }), 'Voided')} />}
      </div>
      {recording && <RecordPayment referral={r} methods={methods} onDone={() => { setRecording(false); onChanged(); }} onCancel={() => setRecording(false)} />}
    </li>
  );
}

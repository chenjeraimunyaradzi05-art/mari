'use client';

/**
 * One purchase, under buyer protection: the steps as a timeline, the one
 * that is next lit up, the money's whereabouts, and the actions each side
 * has at this point. Paying holds the money on a card through the same
 * escrow form the rest of the platform uses; the release, the dispute and
 * the cancellation are each one honest button.
 *
 * The card step is resumable, and this page is where that shows. It used to
 * offer the Pay button for exactly one status and drop the client secret the
 * moment the form closed, so a woman who shut the card form — or whose card
 * was declined — was left looking at a page that said her money was held, a
 * seller who had been told the same, and no way back in. Nothing here claims
 * the money is held until the hold has actually authorised, and the button to
 * finish paying stays until it has.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { autoApi, autoError, aud0, km, type InspectionCard, type PurchaseCard } from '@/lib/automotive-api';
import { AutoNav, Confirm, ErrorBox, Loading, PageTitle, PayHold, StarPicker, StatusChip, fmtDay, fmtWhen, useLoad } from '@/components/automotive/AutoUi';
import { Field, Panel, Stat, inputClass } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';
import { safeHref } from '@/lib/safe-href';

type Detail = PurchaseCard & { inspections: InspectionCard[]; checks: { ppsr: { url: string; ready: boolean }; rego: { name: string; url: string } | null } };
const STEPS: Array<{ key: string; label: string; done: (s: string) => boolean; now: (s: string) => boolean }> = [
  { key: 'offer', label: 'Offer', done: (s) => s !== 'OFFERED', now: (s) => s === 'OFFERED' },
  { key: 'accept', label: 'Accepted', done: (s) => !['OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED'].includes(s), now: (s) => s === 'ACCEPTED' },
  { key: 'pay', label: 'Money held', done: (s) => ['HANDED_OVER', 'RELEASED', 'DISPUTED', 'REFUNDED'].includes(s), now: (s) => s === 'PAID_HELD' },
  { key: 'handover', label: 'Handover and inspection period', done: (s) => ['RELEASED', 'DISPUTED', 'REFUNDED'].includes(s), now: (s) => s === 'HANDED_OVER' },
  { key: 'release', label: 'Released to the seller', done: (s) => s === 'RELEASED', now: (s) => s === 'DISPUTED' },
];

export default function PurchasePage() {
  const params = useParams<{ id: string }>();
  const data = useLoad<Detail>(() => autoApi.purchase(params.id), [params.id]);
  // The car and an inspection fee share this one card form, so what it is for
  // has to travel with it: only the purchase has a hold the server must be
  // asked to confirm afterwards, and confirming the wrong one would mark a car
  // paid for on the strength of an inspector's invoice.
  const [paying, setPaying] = useState<{ kind: 'purchase' | 'inspection'; clientSecret: string | null; amount: number } | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [review, setReview] = useState({ rating: 0, comment: '' });
  const [resolveNote, setResolveNote] = useState('');
  const [busy, setBusy] = useState(false);
  const p = data.data;
  // What the hold behind this purchase has come to. The server will not say
  // the money is held until the card has authorised, so these are the three
  // things the page has to be able to say without lying: nothing started, a
  // card step left unfinished, and money really held.
  const holdReal = Boolean(p?.escrow && ['AUTHORIZED', 'CAPTURED'].includes(p.escrow.status));
  const holdLive = Boolean(p?.escrow && !['CANCELED', 'REFUNDED', 'FAILED'].includes(p.escrow.status));
  const needsCard = Boolean(p && p.role === 'buyer' && ['ACCEPTED', 'PAID_HELD'].includes(p.status) && !holdReal);

  const act = async (fn: () => Promise<unknown>, done: string) => { setBusy(true); try { await fn(); toast.success(done); data.reload(); } catch (err) { toast.error(autoError(err, 'That did not work.')); } finally { setBusy(false); } };
  const openHold = (payment: { clientSecret?: string | null; amount?: number } | null | undefined) => setPaying({ kind: 'purchase', clientSecret: payment?.clientSecret ?? null, amount: payment?.amount ?? (p ? (p.agreedAmount ?? p.offerAmount) * 100 : 0) });
  /** Starting the card step, or starting it over after a card that was declined. */
  const pay = async () => { if (!p) return; setBusy(true); try { const res = await autoApi.pay(p.id); if (res.data.data.alreadyHeld) { toast.success('That payment has already gone through.'); data.reload(); return; } openHold(res.data.data.payment); } catch (err) { toast.error(autoError(err, 'The payment could not be started.')); } finally { setBusy(false); } };
  /**
   * The card says it is authorised; the server checks with the processor
   * before anything is marked paid and before the seller hears a word. A
   * failure here leaves the form open on purpose, because the honest next step
   * is to try the card again rather than to close the page on a purchase whose
   * money is in limbo.
   */
  const confirmHold = async () => { if (!p) return; setBusy(true); try { await api.post(`/automotive/purchases/${p.id}/payment/confirm`); setPaying(null); toast.success('Held. The seller has been told.'); } catch (err) { toast.error(autoError(err, 'The hold could not be confirmed, so nothing has been taken from your card.')); } finally { setBusy(false); data.reload(); } };
  /** Coming back to a card form she left. A read, not a second hold against the same car. */
  const resume = async () => { if (!p) return; setBusy(true); try { const res = await autoApi.purchasePayment(p.id); if (res.data.data.held) { await confirmHold(); return; } openHold(res.data.data); } catch (err) { toast.error(autoError(err, 'That card form could not be reopened. Try paying again.')); } finally { setBusy(false); } };
  const payInspection = async (id: string) => { setBusy(true); try { const res = await autoApi.payInspection(id); if (res.data.data.alreadyHeld) toast('Already held.'); else setPaying({ kind: 'inspection', clientSecret: res.data.data.clientSecret ?? null, amount: res.data.data.amount }); } catch (err) { toast.error(autoError(err, 'The fee could not be paid.')); } finally { setBusy(false); } };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <AutoNav current="/dashboard/cars/purchases" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {p && (
        <>
          <PageTitle icon={ShieldCheck} kicker={p.role === 'buyer' ? 'You are buying' : p.role === 'seller' ? 'You are selling' : 'Admin view'} title={p.listing.title} blurb={`${p.listing.year} ${p.listing.make} ${p.listing.model} · ${km(p.listing.odometerKm)} · ${[p.listing.suburb || p.listing.city, p.listing.state].filter(Boolean).join(', ')}`} action={<div className="flex flex-wrap items-center gap-2"><StatusChip status={p.status} /><Link href={`/cars/preloved/${p.listing.id}`} className="btn-ghost text-sm">The listing</Link></div>} />
          <ol className="grid gap-2 sm:grid-cols-5">{STEPS.map((s, i) => { const done = s.done(p.status); const now = s.now(p.status); return <li key={s.key} className={cn('rounded-xl border p-3 text-xs', done ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100' : now ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-100' : 'border-slate-200 text-slate-500 dark:border-slate-800')}><span className="font-semibold">{i + 1}. {s.label}</span></li>; })}</ol>
          {['DECLINED', 'CANCELLED', 'REFUNDED'].includes(p.status) && <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{p.nextStep}{p.cancelReason ? ` Reason: ${p.cancelReason}` : ''}{p.disputeResolution ? ` ${p.disputeResolution}` : ''}</div>}

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="space-y-6">
              <Panel title="Where it is" intro={p.nextStep}>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Price</dt><dd className="font-semibold text-slate-900 dark:text-white">{aud0(p.agreedAmount ?? p.offerAmount)}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">The money</dt><dd className="text-slate-800 dark:text-slate-200">{!p.escrow ? 'Not yet paid' : p.escrow.status === 'CAPTURED' ? 'Released to the seller' : ['CANCELED', 'REFUNDED'].includes(p.escrow.status) ? 'Returned to the buyer' : p.escrow.status === 'AUTHORIZED' ? 'Held by ATHENA' : p.escrow.status === 'FAILED' ? 'The card did not go through, so nothing is held' : 'Not held yet: the card has not been authorised'}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">ATHENA's fee</dt><dd className="text-slate-800 dark:text-slate-200">{aud0(p.platformFee)}, from the seller's side</dd></div>
                  {p.paidAt && <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Paid</dt><dd className="text-slate-800 dark:text-slate-200">{fmtWhen(p.paidAt)}</dd></div>}
                  {p.handedOverAt && <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Handed over</dt><dd className="text-slate-800 dark:text-slate-200">{fmtWhen(p.handedOverAt)}</dd></div>}
                  {p.inspectionEndsAt && <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Inspection period ends</dt><dd className="text-slate-800 dark:text-slate-200">{fmtWhen(p.inspectionEndsAt)}{p.status === 'HANDED_OVER' ? ` (${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'})` : ''}</dd></div>}
                  {p.releasedAt && <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Released</dt><dd className="text-slate-800 dark:text-slate-200">{fmtWhen(p.releasedAt)}</dd></div>}
                </dl>
                {p.message && <p className="mt-3 text-sm text-slate-700 dark:text-slate-300"><span className="text-xs uppercase tracking-wide text-slate-500">Buyer said: </span>{p.message}</p>}
                {p.sellerMessage && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300"><span className="text-xs uppercase tracking-wide text-slate-500">Seller said: </span>{p.sellerMessage}</p>}
                {p.transferNote && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300"><span className="text-xs uppercase tracking-wide text-slate-500">At handover: </span>{p.transferNote}</p>}
                {p.disputeReason && <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm dark:bg-rose-900/20"><p className="text-xs uppercase tracking-wide text-rose-700 dark:text-rose-300">Dispute, opened {p.disputeOpenedAt ? fmtDay(p.disputeOpenedAt) : ''}</p><p className="mt-1 text-slate-800 dark:text-slate-200">{p.disputeReason}</p>{p.disputeResolution && <p className="mt-2 font-medium text-slate-900 dark:text-white">Decision: {p.disputeResolution}</p>}</div>}
              </Panel>

              {paying && <Panel title={paying.kind === 'purchase' ? 'Hold the money' : 'Pay the inspection fee'} intro={paying.kind === 'purchase' ? 'Authorised on your card now, taken only when the money is released. Nothing reaches the seller until then. You can close this and finish it later; the seller is told nothing until your card goes through.' : 'Authorised on your card now, released to the workshop when the report is in.'}><PayHold clientSecret={paying.clientSecret} amountLabel={aud0(paying.amount / 100)} what={p.listing.title} onDone={paying.kind === 'purchase' ? confirmHold : () => { setPaying(null); toast.success('Held.'); data.reload(); }} onCancel={() => setPaying(null)} /></Panel>}

              {p.inspections.length > 0 && <Panel title="Inspections" intro="Reports on this car, from workshops in the directory.">
                <ul className="space-y-2">{p.inspections.map((i) => <li key={i.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900 dark:text-white">{i.inspector?.name ?? (i.kind === 'SELLER_PROVIDED' ? 'Provided by the seller' : 'Awaiting a workshop')}{i.scheduledAt ? ` · ${fmtWhen(i.scheduledAt)}` : ''}</span><StatusChip status={i.outcome ?? i.status} /></div>{i.summary && <p className="mt-1 text-slate-700 dark:text-slate-300">{i.summary}</p>}{i.report.length > 0 && <ul className="mt-2 grid gap-1 sm:grid-cols-2">{i.report.map((s) => <li key={s.key} className="text-xs"><span className={cn('font-semibold', s.result === 'PASS' ? 'text-emerald-700' : s.result === 'FAIL' ? 'text-rose-700' : 'text-amber-700')}>{s.result}</span> {s.label}{s.notes ? `: ${s.notes}` : ''}</li>)}</ul>}<div className="mt-2 flex flex-wrap gap-2 text-xs">{i.reportUrl && <a href={safeHref(i.reportUrl)} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600">Report file</a>}{i.isRequester && i.inspector && !i.escrowStatus && i.fee > 0 && ['ASSIGNED', 'SCHEDULED', 'COMPLETED'].includes(i.status) && <button type="button" disabled={busy} onClick={() => payInspection(i.id)} className="rounded-md bg-slate-900 px-2 py-1 font-semibold text-white dark:bg-white dark:text-slate-900">Pay the {aud0(i.fee)} fee into holding</button>}{i.isRequester && i.status === 'COMPLETED' && i.escrowStatus && i.escrowStatus !== 'CAPTURED' && <button type="button" disabled={busy} onClick={() => act(() => autoApi.releaseInspection(i.id), 'Fee released to the workshop')} className="rounded-md bg-emerald-500 px-2 py-1 font-semibold text-white">Release the fee</button>}{i.isRequester && ['REQUESTED', 'ASSIGNED', 'SCHEDULED'].includes(i.status) && <button type="button" disabled={busy} onClick={() => act(() => autoApi.updateInspection(i.id, { status: 'CANCELLED' }), 'Inspection cancelled')} className="text-slate-500 hover:text-rose-600">Cancel</button>}</div></li>)}</ul>
              </Panel>}
            </div>

            <div className="space-y-6">
              <Panel title={p.role === 'buyer' ? 'What you can do' : p.role === 'seller' ? 'What you can do' : 'Admin'}>
                <div className="space-y-3">
                  {p.role === 'seller' && p.status === 'OFFERED' && <><Field label="A word back (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={inputClass} /></Field><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => act(() => autoApi.acceptOffer(p.id, { message: note || undefined }), 'Accepted. The buyer has been asked to pay.')} className="btn-primary text-sm">Accept {aud0(p.offerAmount)}</button><button type="button" disabled={busy} onClick={() => act(() => autoApi.declineOffer(p.id, { message: note || undefined }), 'Declined')} className="btn-secondary text-sm">Decline</button></div></>}
                  {needsCard && !paying && <><p className="text-sm text-slate-700 dark:text-slate-300">{!p.escrow ? `Pay ${aud0(p.agreedAmount ?? p.offerAmount)} through ATHENA. It is held, not sent. The seller is told the money is there and you arrange the handover.` : holdLive ? `You started paying and did not finish, so nothing has been taken and nothing is held. Pick up where you left off and the ${aud0(p.agreedAmount ?? p.offerAmount)} is held for you.` : `That card did not go through, so nothing was taken. Try again and the ${aud0(p.agreedAmount ?? p.offerAmount)} is held, not sent.`}</p><button type="button" disabled={busy} onClick={p.escrow && holdLive ? resume : pay} className="btn-primary w-full text-sm disabled:opacity-50">{!p.escrow ? 'Pay into holding' : holdLive ? 'Finish paying' : 'Try paying again'}</button></>}
                  {p.role === 'buyer' && p.status === 'PAID_HELD' && holdReal && <><p className="text-sm text-slate-700 dark:text-slate-300">Collect the car with the papers: registration in the seller's name, the PPSR certificate, both keys, the service book. Then confirm you have it; the {p.inspectionDays}-day inspection period starts.</p><Field label="A note for the record"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={inputClass} placeholder="Collected Saturday with both keys and the service book" /></Field><Confirm label="I have the car" tone="emerald" hint="Starts the inspection period. The money stays held." onConfirm={() => act(() => autoApi.handover(p.id, { note: note || undefined }), 'Confirmed. The inspection period has started.')} /></>}
                  {p.role === 'buyer' && p.status === 'HANDED_OVER' && <><p className="text-sm text-slate-700 dark:text-slate-300">{p.daysLeft} day{p.daysLeft === 1 ? '' : 's'} left. Satisfied? Release the money. Not as described? Open a dispute and say why; ATHENA reads both sides and decides.</p><Confirm label="Release the money to the seller" tone="emerald" hint="This cannot be undone." onConfirm={() => act(() => autoApi.release(p.id), 'Released. Enjoy the car.')} /><Field label="Or open a dispute: what is not as described?"><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={4000} className={inputClass} /></Field><button type="button" disabled={busy || reason.trim().length < 20} onClick={() => act(() => autoApi.dispute(p.id, { reason }), 'Dispute opened. The money stays held.')} className="btn-secondary w-full text-sm disabled:opacity-50">Open a dispute</button></>}
                  {p.role === 'buyer' && p.status === 'RELEASED' && !p.reviewRating && <><StarPicker label="How did it go?" value={review.rating} onChange={(v) => setReview((x) => ({ ...x, rating: v }))} /><Field label="A word for the next buyer"><input value={review.comment} onChange={(e) => setReview((x) => ({ ...x, comment: e.target.value }))} maxLength={1000} className={inputClass} /></Field><button type="button" disabled={busy || !review.rating} onClick={() => act(() => autoApi.reviewPurchase(p.id, review), 'Thank you.')} className="btn-primary text-sm disabled:opacity-50">Leave it</button></>}
                  {p.reviewRating && <p className="text-sm text-slate-700 dark:text-slate-300">Rated {p.reviewRating} of 5{p.reviewComment ? `: “${p.reviewComment}”` : ''}.</p>}
                  {['OFFERED', 'ACCEPTED', 'PAID_HELD'].includes(p.status) && p.role !== 'admin' && <><Field label="Reason, if you cancel"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} className={inputClass} /></Field><Confirm label="Cancel this purchase" tone="slate" hint={holdReal ? 'The held money goes back to the buyer.' : holdLive && p.escrow ? 'Nothing has been taken from the buyer\'s card, and the hold is released.' : 'Ends this offer.'} onConfirm={() => act(() => autoApi.cancelPurchase(p.id, { reason: reason || undefined }), 'Cancelled')} /></>}
                  {p.role === 'admin' && p.status === 'DISPUTED' && <><Field label="The decision, in words both will read"><textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} rows={3} maxLength={2000} className={inputClass} /></Field><div className="flex gap-2"><button type="button" disabled={busy || resolveNote.trim().length < 5} onClick={() => act(() => autoApi.resolvePurchase(p.id, { outcome: 'REFUND', note: resolveNote }), 'Refunded to the buyer')} className="btn-primary text-sm disabled:opacity-50">Refund the buyer</button><button type="button" disabled={busy || resolveNote.trim().length < 5} onClick={() => act(() => autoApi.resolvePurchase(p.id, { outcome: 'RELEASE', note: resolveNote }), 'Released to the seller')} className="btn-secondary text-sm disabled:opacity-50">Release to the seller</button></div></>}
                  {['RELEASED', 'REFUNDED', 'DECLINED', 'CANCELLED'].includes(p.status) && p.role === 'seller' && <p className="text-sm text-slate-500">Nothing more to do here.</p>}
                </div>
              </Panel>
              <Panel title="The other party" intro={p.role === 'buyer' ? `${p.seller.name}${p.seller.email ? ` · ${p.seller.email}` : ''}` : `${p.buyer.name}${p.buyer.email ? ` · ${p.buyer.email}` : ''}`}>
                <a href={`/dashboard/messages?user=${p.role === 'buyer' ? p.seller.id : p.buyer.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600"><MessageSquare className="h-4 w-4" /> Message them</a>
                <p className="mt-2 text-xs text-slate-500">Email addresses are shared once the money is held, so the handover can be arranged. Keep payment inside ATHENA; anything asked for outside it is not protected.</p>
              </Panel>
              {p.role === 'buyer' && <Panel title="Checks before you release"><ul className="space-y-1 text-sm"><li><a href={safeHref(p.checks.ppsr.url)} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600">PPSR certificate</a>{p.listing.vin ? <span className="text-xs text-slate-500"> · VIN {p.listing.vin}</span> : ''}</li>{p.checks.rego && <li><a href={safeHref(p.checks.rego.url)} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600">{p.checks.rego.name}</a>{p.listing.rego ? <span className="text-xs text-slate-500"> · {p.listing.rego}</span> : ''}</li>}<li><Link href="/cars/safety" className="font-semibold text-rose-600">What an inspection covers</Link></li></ul><div className="mt-3"><Stat label="Transfer" value="Within 14 days" sub="Most states give fourteen days to transfer the registration into your name; the seller lodges a notice of disposal." /></div></Panel>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

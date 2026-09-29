'use client';

/**
 * The referral ledger: every fee partners owe ATHENA for an introduction made
 * here, what has actually been paid against each one, and the bank statement
 * the payments are checked against.
 *
 * The ledger used to be a status dropdown. "Paid" was whatever an admin had
 * chosen, so the total received was a sum of clicks and nothing on the page
 * could be compared with the bank account. Now a payment is recorded with its
 * amount, the day it arrived and its reference; a Stripe payment is checked
 * with Stripe as it is recorded; and the statement ATHENA exports from its
 * bank is brought here and matched line by line, so the page says which money
 * the bank has shown and which it has not — including money the ledger says
 * arrived and the statement does not have, which is the one that matters.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Download, FileUp, Landmark } from 'lucide-react';
import { autoApi, autoError, audCents, type AdminReferralCard, type BankLine, type LedgerAttentionRow, type MatchedPayment, type PaymentMethodWords, type ReferralFees, type ReferralTotals, type Reconciliation, type StatementColumns } from '@/lib/automotive-api';
import { AutoNav, ErrorBox, Loading, PageTitle, fmtDay, useLoad } from '@/components/automotive/AutoUi';
import { AddReferralFee, ReferralLedgerItem, ledgerIntro } from '@/components/automotive/ReferralLedger';
import { Check, Field, Panel, SelectInput, Stat } from '@/components/strategy/StrategyUi';
import { downloadBlob } from '@/lib/download';
import { cn } from '@/lib/utils';

type Ledger = { referrals: AdminReferralCard[]; totals: ReferralTotals; attention: LedgerAttentionRow[]; fees: ReferralFees; methods: PaymentMethodWords; toleranceDays: number; stripeConfigured: boolean };

/** How many fees the list route answers with at most; the totals always cover every fee. */
const LIST_LIMIT = 200;

const STATUSES = [{ value: '', label: 'Every status' }, { value: 'PENDING', label: 'Pending' }, { value: 'CONFIRMED', label: 'Confirmed, owed' }, { value: 'PAID', label: 'Paid' }, { value: 'VOID', label: 'Void' }];
const KINDS = [{ value: '', label: 'Every kind' }, { value: 'DEALER_SALE', label: 'Dealership sale' }, { value: 'FINANCE', label: 'Loan settled' }, { value: 'INSURANCE', label: 'Policy taken' }, { value: 'WARRANTY', label: 'Extended warranty' }, { value: 'PARTS', label: 'Parts supplied' }, { value: 'FLEET', label: 'Fleet programme' }];

const day = (iso: string) => fmtDay(iso, { day: 'numeric', month: 'short', year: 'numeric' });

// -------------------------------------------------------------- statement

function ColumnPicker({ read, onUse }: { read: Reconciliation; onUse: (map: StatementColumns) => void }) {
  const options = Array.from({ length: read.columns }, (_, i) => ({ value: String(i), label: `Column ${i + 1}${read.sample[0]?.[i] ? `: ${read.sample[0][i].slice(0, 24)}` : ''}` }));
  const [date, setDate] = useState('0');
  const [money, setMoney] = useState('1');
  const [moneyIs, setMoneyIs] = useState<'amount' | 'credit'>('amount');
  const [desc, setDesc] = useState(String(Math.min(2, Math.max(0, read.columns - 1))));
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-amber-200 p-3 dark:border-amber-900/40">
      <p className="text-xs text-slate-700 dark:text-slate-300">This statement does not say which column is which in a way a bank usually writes it. Here are its first lines; say where the date, the money and the description are.</p>
      <div className="overflow-x-auto"><table className="text-left text-[11px]"><tbody>{read.sample.map((cells, i) => <tr key={i} className="border-b border-slate-100 dark:border-slate-800">{cells.map((c, j) => <td key={j} className="whitespace-nowrap px-2 py-1 text-slate-700 dark:text-slate-300">{c}</td>)}</tr>)}</tbody></table></div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Date"><SelectInput value={date} onChange={setDate} options={options} /></Field>
        <Field label="Description"><SelectInput value={desc} onChange={setDesc} options={options} /></Field>
        <Field label="Money column"><SelectInput value={money} onChange={setMoney} options={options} /></Field>
        <Field label="That column is"><SelectInput value={moneyIs} onChange={(v) => setMoneyIs(v as 'amount' | 'credit')} options={[{ value: 'amount', label: 'The amount: money in positive, money out negative' }, { value: 'credit', label: 'Credits only: money in, empty for money out' }]} /></Field>
      </div>
      <button type="button" onClick={() => onUse({ date: Number(date), amount: moneyIs === 'amount' ? Number(money) : null, credit: moneyIs === 'credit' ? Number(money) : null, description: [Number(desc)] })} className="btn-primary text-xs">Read it this way</button>
    </div>
  );
}

function LineList({ title, tone = 'plain', lines, note }: { title: string; tone?: 'plain' | 'warn' | 'bad'; lines: Array<BankLine & { receipts?: MatchedPayment[] }>; note?: (l: BankLine & { receipts?: MatchedPayment[] }) => string }) {
  if (!lines.length) return null;
  return (
    <div className={cn('rounded-lg p-3', tone === 'bad' ? 'bg-red-50 dark:bg-red-900/20' : tone === 'warn' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800/60')}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{title} ({lines.length})</p>
      <ul className="mt-1 space-y-1 text-xs text-slate-700 dark:text-slate-300">{lines.map((l) => <li key={l.line}>Line {l.line}: {day(l.date)} · {audCents(l.amountCents)} · {l.description || 'no description'}{note ? ` — ${note(l)}` : ''}</li>)}</ul>
    </div>
  );
}

function StatementPanel({ fees, onApplied }: { fees: Map<string, AdminReferralCard>; onApplied: () => void }) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [map, setMap] = useState<StatementColumns | undefined>(undefined);
  const [read, setRead] = useState<Reconciliation | null>(null);
  const [accept, setAccept] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const who = (p: MatchedPayment) => { const f = fees.get(p.referralId); return f ? `${f.partner ?? f.kindLabel} (${f.kindLabel.toLowerCase()})` : 'a fee'; };
  const payments = (l: { receipts?: MatchedPayment[] }) => (l.receipts ?? []).map((p) => `${audCents(p.amountCents)} from ${who(p)}, ref ${p.reference}`).join('; ');

  const preview = async (text: string, name: string, columns?: StatementColumns) => {
    setBusy(true);
    try {
      const res = await autoApi.admin.reconcileReferrals({ csv: text, statement: name, map: columns });
      setRead(res.data.data as Reconciliation);
      setAccept([]);
    } catch (err) { toast.error(autoError(err, 'That statement could not be read.')); } finally { setBusy(false); }
  };
  const choose = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    setFile({ name: f.name, text });
    setMap(undefined);
    await preview(text, f.name);
  };
  const apply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await autoApi.admin.reconcileReferrals({ csv: file.text, statement: file.name, map, apply: true, accept });
      const done = res.data.data as Reconciliation;
      toast.success(`${done.reconciled ?? 0} ${done.reconciled === 1 ? 'payment' : 'payments'} matched to the statement`);
      setFile(null); setRead(null); setAccept([]); setMap(undefined);
      onApplied();
    } catch (err) { toast.error(autoError(err, 'Nothing was matched.')); } finally { setBusy(false); }
  };
  const toWrite = (read?.matches ?? []).reduce((s, m) => s + m.receipts.length, 0) + (read?.suggestions ?? []).filter((s) => accept.includes(s.line)).reduce((s, m) => s + m.receipts.length, 0);

  return (
    <Panel icon={Landmark} title="Match a bank statement" intro="Export the statement for ATHENA's account from the bank as CSV and bring it here. Each payment recorded by bank transfer, cheque or another way is matched to the line that shows it: the reference has to be on the line, and the amount and the day have to agree. Nothing is written until you say so.">
      <label className={cn('btn-primary inline-flex cursor-pointer items-center gap-2 text-sm', busy && 'pointer-events-none opacity-50')}><FileUp className="h-4 w-4" /> Choose a statement<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} /></label>
      {file && <p className="mt-2 text-xs text-slate-500">{file.name}</p>}
      {read && read.errors.length > 0 && <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300"><p className="font-semibold">Lines that could not be read — nothing will be matched until the statement reads cleanly</p><ul className="mt-1 space-y-1">{read.errors.map((e) => <li key={`${e.line}-${e.message}`}>Line {e.line}: {e.message}</li>)}</ul></div>}
      {read && read.needsMapping && file && <ColumnPicker read={read} onUse={(m) => { setMap(m); void preview(file.text, file.name, m); }} />}
      {read && !read.needsMapping && read.map && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">{read.credits ?? 0} {read.credits === 1 ? 'credit' : 'credits'}{read.from ? ` from ${day(read.from)} to ${day(read.to ?? read.from)}` : ''}. {read.matches?.length ?? 0} matched, {read.suggestions?.length ?? 0} to decide, {read.alreadyReconciled?.length ?? 0} matched before.{read.skipped ? ` ${read.skipped} ${read.skipped === 1 ? 'line was' : 'lines were'} not a transaction (a heading or a balance) and ${read.skipped === 1 ? 'was' : 'were'} left out.` : ''}</p>
          {(read.unmatchedReceipts ?? []).length > 0 && (
            <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">Recorded as received, and not on this statement ({read.unmatchedReceipts!.length})</p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">The ledger says this money arrived between these dates and the bank does not show it. Check the reference and the day; if it never came, reverse the payment.</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-700 dark:text-slate-300">{read.unmatchedReceipts!.map((p) => <li key={p.paymentId}>{day(p.receivedOn)} · {audCents(p.amountCents)} from {who(p)}, ref {p.reference}</li>)}</ul>
            </div>
          )}
          <LineList title="Matched" lines={read.matches ?? []} note={payments} />
          {(read.suggestions ?? []).length > 0 && (
            <div className="rounded-lg bg-sky-50 p-3 dark:bg-sky-900/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">The amount and the day fit, but the reference is not on the line ({read.suggestions!.length})</p>
              <ul className="mt-1 space-y-1">{read.suggestions!.map((s) => <li key={s.line}><Check checked={accept.includes(s.line)} onChange={(on) => setAccept((a) => (on ? [...a, s.line] : a.filter((x) => x !== s.line)))} label={`Line ${s.line}: ${day(s.date)} · ${audCents(s.amountCents)} · ${s.description || 'no description'}`} hint={`Is this ${payments(s)}?`} /></li>)}</ul>
            </div>
          )}
          <LineList title="Lines more than one set of payments could be" tone="warn" lines={read.ambiguous ?? []} note={() => 'match these by hand: check the fee each belongs to'} />
          <LineList title="Money in with no payment recorded for it" tone="warn" lines={read.unmatchedCredits ?? []} note={() => 'a partner paying a fee not recorded yet, or income that is not a referral'} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || toWrite === 0 || read.errors.length > 0} onClick={apply} className="btn-primary text-sm disabled:opacity-50">{toWrite === 0 ? 'Nothing to match' : `Match ${toWrite} ${toWrite === 1 ? 'payment' : 'payments'}`}</button>
            <button type="button" onClick={() => { setFile(null); setRead(null); setAccept([]); setMap(undefined); }} className="btn-ghost text-sm">Put it away</button>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------- page

export default function ReferralLedgerPage() {
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const data = useLoad<Ledger>(() => autoApi.admin.referrals({ status: status || undefined, kind: kind || undefined }), [status, kind]);
  const [busy, setBusy] = useState(false);
  const o = data.data;
  const fees = useMemo(() => new Map((o?.referrals ?? []).map((r) => [r.id, r])), [o]);
  const exportCsv = async () => {
    setBusy(true);
    try { const res = await autoApi.admin.exportReferralPayments(); downloadBlob(`athena-referral-payments-${new Date().toISOString().slice(0, 10)}.csv`, res.data as Blob); } catch (err) { toast.error(autoError(err, 'The payments could not be exported.')); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Landmark} kicker="Cars · admin" title="The referral ledger" blurb={o ? ledgerIntro(o.totals) : 'What partners owe ATHENA for introductions, and what they have paid.'} action={<Link href="/dashboard/cars/admin" className="btn-ghost text-sm">Back to the queues</Link>} />
      <AutoNav current="/dashboard/cars/admin" />
      {data.loading && !o && <Loading />}
      <ErrorBox error={data.error} />
      {o && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Pending" value={audCents(o.totals.pending * 100)} sub="not yet checked with the partner" />
            <Stat label="Owed" value={audCents(o.totals.confirmed * 100)} sub={o.totals.partPaid ? `${o.totals.partPaid} part paid` : 'confirmed, not yet paid'} tone="warn" />
            <Stat label="Received" value={audCents(o.totals.paid * 100)} sub="recorded against a payment" tone="good" />
            <Stat label="Not yet checked" value={audCents(o.totals.unreconciled * 100)} sub="against the bank or Stripe" tone={o.totals.unreconciled > 0 ? 'warn' : 'plain'} />
          </div>
          {o.totals.unreadable > 0 && <ErrorBox error={`${o.totals.unreadable} ledger ${o.totals.unreadable === 1 ? 'entry' : 'entries'} could not be read, so the totals may be short. Tell whoever looks after the platform; nothing on the ledger writes entries like that.`} />}

          {o.attention.length > 0 && (
            <Panel title={`Needs a look (${o.attention.length})`} intro={o.totals.heldOnVoid > 0 ? `${audCents(o.totals.heldOnVoid * 100)} is recorded against fees that are void.` : undefined}>
              <ul className="space-y-1">{o.attention.map((a) => <li key={`${a.referralId}-${a.key}`} className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-100"><span className="font-semibold">{a.kindLabel} · {a.partner ?? 'partner not named'}</span>: {a.words}</li>)}</ul>
            </Panel>
          )}

          <Panel title="Fees" aside={<button type="button" disabled={busy} onClick={exportCsv} className="btn-secondary inline-flex items-center gap-2 text-xs disabled:opacity-50"><Download className="h-4 w-4" /> Payments as CSV</button>}>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Status"><SelectInput value={status} onChange={setStatus} options={STATUSES} /></Field>
              <Field label="Kind"><SelectInput value={kind} onChange={setKind} options={KINDS} /></Field>
            </div>
            <ul className="mt-3 space-y-2">{o.referrals.map((r) => <ReferralLedgerItem key={r.id} referral={r} methods={o.methods} stripeConfigured={o.stripeConfigured} onChanged={data.reload} />)}{o.referrals.length === 0 && <li className="text-sm text-slate-500">No fees match.</li>}</ul>
            {o.referrals.length >= LIST_LIMIT && <p className="mt-2 text-xs text-slate-500">These are the newest {LIST_LIMIT}. Narrow the list by status or kind to see older ones; the totals above cover every fee.</p>}
            <AddReferralFee onDone={data.reload} />
            <p className="mt-2 text-xs leading-5 text-slate-500">{Object.values(o.fees).map((f) => f.words).join(' ')}</p>
          </Panel>

          <StatementPanel fees={fees} onApplied={data.reload} />
          {!o.stripeConfigured && <p className="text-xs text-slate-500">This server has no Stripe key, so a payment recorded as Stripe is kept as not checked until one is configured; it can then be checked from its fee.</p>}
        </div>
      )}
    </div>
  );
}

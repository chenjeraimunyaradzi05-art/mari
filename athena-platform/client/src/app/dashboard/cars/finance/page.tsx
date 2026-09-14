'use client';

/**
 * Car finance pre-approval: an application built from what a lender
 * reads, scored for readiness before it is sent, tracked through the
 * desk's decision, and expiring on a date she can see. The public finance
 * page does the arithmetic; this page carries the paperwork.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { FileCheck2 } from 'lucide-react';
import { autoApi, autoError, aud0, type ApplicationCard } from '@/lib/automotive-api';
import { AutoNav, Confirm, Empty, ErrorBox, Loading, PageTitle, StatusChip, fmtDay, fmtWhen, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Check, Field, Notes, NumberInput, Panel, Pending, SelectInput, Stat, num, opt, useCalc } from '@/components/strategy/StrategyUi';

type Readiness = { score: number; band: string; amount: number; repaymentMonthly: number; ratePct: number; notes: string[] };

function Applications() {
  const search = useSearchParams();
  const ref = useReference();
  const data = useLoad<ApplicationCard[]>(() => autoApi.finance.applications());
  const [open, setOpen] = useState(Boolean(search.get('price')));
  const [f, setF] = useState({ purpose: search.get('purpose') ?? 'USED', vehiclePrice: search.get('price') ?? '', deposit: '', tradeIn: '', termMonths: '60', balloonPct: '0', incomeAnnual: '', expensesMonthly: '', otherDebtsMonthly: '', dependants: '0', employment: 'FULL_TIME', employmentMonths: '', residency: 'CITIZEN', hasDefaults: false, listingId: search.get('listingId') ?? '', carModelId: search.get('carModelId') ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const payload = () => ({ purpose: f.purpose, vehiclePrice: num(f.vehiclePrice), deposit: opt(f.deposit), tradeIn: opt(f.tradeIn), termMonths: num(f.termMonths), balloonPct: num(f.balloonPct), incomeAnnual: num(f.incomeAnnual), expensesMonthly: num(f.expensesMonthly), otherDebtsMonthly: opt(f.otherDebtsMonthly), dependants: num(f.dependants), employment: f.employment, employmentMonths: f.employmentMonths ? num(f.employmentMonths) : null, residency: f.residency, hasDefaults: f.hasDefaults, listingId: f.listingId || null, carModelId: f.carModelId || null });
  const ok = num(f.vehiclePrice) > 0 && num(f.incomeAnnual) > 0 && num(f.expensesMonthly) > 0;
  const ready = useCalc<Readiness>(autoApi.finance.readiness, { ...payload(), employmentMonths: opt(f.employmentMonths), vehicleAgeYears: f.purpose === 'NEW' ? 0 : 5 }, ok);
  const submit = async (send: boolean) => { setBusy(true); try { await autoApi.finance.apply({ ...payload(), submit: send }); toast.success(send ? 'Sent to the finance desk. You will hear back here and by notification.' : 'Saved as a draft.'); setOpen(false); data.reload(); } catch (err) { toast.error(autoError(err, 'That could not be saved.')); } finally { setBusy(false); } };
  const act = async (fn: () => Promise<unknown>, done: string) => { setBusy(true); try { await fn(); toast.success(done); data.reload(); } catch (err) { toast.error(autoError(err, 'That did not work.')); } finally { setBusy(false); } };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={FileCheck2} kicker="Cars" title="Finance pre-approval" blurb="What a lender reads, scored before it is sent, and tracked to a decision. A pre-approval lets you negotiate like a cash buyer." action={<button type="button" onClick={() => setOpen((o) => !o)} className="btn-primary text-sm">{open ? 'Close' : 'Start an application'}</button>} />
      <AutoNav current="/dashboard/cars/finance" />
      <p className="text-xs text-slate-500">Applications go to ATHENA's finance desk, which reads them the way a lender does and passes them to a partner lender as one is signed. Nothing here is a credit check; the readiness score is the desk's honest read before anyone runs one.</p>
      {open && (
        <Panel title="The application">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="Buying"><SelectInput value={f.purpose} onChange={(v) => set('purpose', v)} options={[{ value: 'NEW', label: 'A new car' }, { value: 'USED', label: 'A used car' }, { value: 'REFINANCE', label: 'Refinancing a loan' }]} /></Field>
            <Field label="Car price"><NumberInput value={f.vehiclePrice} onChange={(v) => set('vehiclePrice', v)} prefix="$" /></Field>
            <Field label="Deposit"><NumberInput value={f.deposit} onChange={(v) => set('deposit', v)} prefix="$" /></Field>
            <Field label="Trade-in"><NumberInput value={f.tradeIn} onChange={(v) => set('tradeIn', v)} prefix="$" /></Field>
            <Field label="Term (months)"><NumberInput value={f.termMonths} onChange={(v) => set('termMonths', v)} /></Field>
            <Field label="Balloon"><NumberInput value={f.balloonPct} onChange={(v) => set('balloonPct', v)} suffix="%" /></Field>
            <Field label="Income, a year"><NumberInput value={f.incomeAnnual} onChange={(v) => set('incomeAnnual', v)} prefix="$" /></Field>
            <Field label="Living costs, a month"><NumberInput value={f.expensesMonthly} onChange={(v) => set('expensesMonthly', v)} prefix="$" /></Field>
            <Field label="Other repayments, a month"><NumberInput value={f.otherDebtsMonthly} onChange={(v) => set('otherDebtsMonthly', v)} prefix="$" /></Field>
            <Field label="Dependants"><NumberInput value={f.dependants} onChange={(v) => set('dependants', v)} /></Field>
            <Field label="Work"><SelectInput value={f.employment} onChange={(v) => set('employment', v)} options={(ref.data?.finance.employment ?? []).map((e) => ({ value: e.key, label: e.label }))} /></Field>
            <Field label="Months in it"><NumberInput value={f.employmentMonths} onChange={(v) => set('employmentMonths', v)} /></Field>
            <Field label="Residency"><SelectInput value={f.residency} onChange={(v) => set('residency', v)} options={[{ value: 'CITIZEN', label: 'Citizen' }, { value: 'PR', label: 'Permanent resident' }, { value: 'VISA', label: 'On a visa' }]} /></Field>
            <div className="flex items-end pb-2"><Check checked={f.hasDefaults} onChange={(v) => set('hasDefaults', v)} label="A default in the last five years" /></div>
          </div>
          <Pending loading={ready.loading} error={ready.error}>{ready.result && <div className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr]"><Stat label="Readiness" value={`${ready.result.score} / 100`} sub={`Borrowing ${aud0(ready.result.amount)} at about ${ready.result.ratePct}% is ${aud0(ready.result.repaymentMonthly)} a month`} tone={ready.result.band === 'ready' ? 'good' : ready.result.band === 'nearly' ? 'plain' : 'warn'} big /><Notes items={ready.result.notes} title="What the desk will see" /></div>}</Pending>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy || !ok} onClick={() => submit(true)} className="btn-primary text-sm disabled:opacity-50">Send to the desk</button><button type="button" disabled={busy || !ok} onClick={() => submit(false)} className="btn-secondary text-sm disabled:opacity-50">Save a draft</button></div>
          <ul className="mt-3 list-disc pl-5 text-xs text-slate-500">{(ref.data?.finance.lenderChecks ?? []).map((c) => <li key={c}>{c}</li>)}</ul>
        </Panel>
      )}
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && data.data.length === 0 && !open && <Empty title="No application yet" body="Run the numbers on the public finance page first, then start one here. Drafts can be sent later." action={<div className="flex gap-2"><button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm">Start</button><Link href="/cars/finance" className="btn-secondary text-sm">The arithmetic</Link></div>} />}
      <ul className="space-y-3">
        {(data.data ?? []).map((a) => (
          <li key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-slate-900 dark:text-white">{a.referenceCode} · {aud0(a.amount)} over {a.termMonths} months</p><p className="text-xs text-slate-500">{a.purpose === 'NEW' ? 'New car' : a.purpose === 'USED' ? 'Used car' : 'Refinance'} at {aud0(a.vehiclePrice)} · about {aud0(a.repaymentMonthly)} a month at {a.ratePct}% · readiness {a.readinessScore}{a.lender ? ` · ${a.lender}` : ''}</p></div><StatusChip status={a.status} /></div>
            {a.status === 'PRE_APPROVED' && a.expiresAt && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100">Pre-approved until {fmtDay(a.expiresAt, { day: 'numeric', month: 'short', year: 'numeric' })}. Take the reference to the dealer or the seller; the price is now a cash negotiation.</p>}
            {a.decisionNote && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{a.decisionNote}</p>}
            <ol className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">{a.timeline.map((t, i) => <li key={i} className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{t.status.toLowerCase().replace('_', ' ')} · {fmtWhen(t.at)}</li>)}</ol>
            <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">What the desk sees</summary><ul className="mt-1 list-disc pl-4">{a.readinessNotes.map((n) => <li key={n}>{n}</li>)}</ul></details>
            <div className="mt-3 flex flex-wrap gap-2">{['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'PRE_APPROVED'].includes(a.status) && <Confirm label="Withdraw" tone="slate" onConfirm={() => act(() => autoApi.finance.updateApplication(a.id, { withdraw: true }), 'Withdrawn')} />}{a.status === 'DRAFT' && <button type="button" disabled={busy} onClick={() => act(() => autoApi.finance.updateApplication(a.id, { submit: true }), 'Sent to the desk')} className="btn-primary text-sm disabled:opacity-50">Send to the desk</button>}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FinanceApplicationsPage() {
  return <Suspense fallback={<div className="p-6"><Loading /></div>}><Applications /></Suspense>;
}

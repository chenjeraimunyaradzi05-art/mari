'use client';

/**
 * The debt suite: cards and loans paid off in the order that costs least
 * (or the order that keeps you going), when they are gone, and whether
 * rolling them into one loan helps or just runs longer. The HELP debt has
 * its own place in the tax plan because it is repaid through tax.
 */

import { useState } from 'react';
import Link from 'next/link';
import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { strategyApi } from '@/lib/strategy-api';
import { Disclaimer, Field, LineChart, Notes, NumberInput, Panel, Pending, SelectInput, Stat, aud, inputClass, num, opt, pct, useCalc } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type DebtRow = { name: string; balance: string; ratePct: string; minPayment: string };
type Plan = { method: string; months: number | null; totalInterest: number; totalPaid: number; monthlyOutlay: number; order: Array<{ name: string; clearedMonth: number | null; interest: number }>; series: Array<{ month: number; balance: number }> };
type Result = { asAt: string; totalBalance: number; minimumsTotal: number; weightedRatePct: number; chosen: Plan; other: Plan; consolidation: { repayment: number; months: number; totalInterest: number; savesVsPlan: number; monthsLonger: number; verdict: string } | null; notes: string[] };

const EMPTY: DebtRow = { name: '', balance: '', ratePct: '', minPayment: '' };
const months = (m: number | null) => (m === null ? 'over 50 years' : m < 12 ? `${m} months` : `${Math.floor(m / 12)} yr ${m % 12} mo`);

export default function DebtPage() {
  const [debts, setDebts] = useState<DebtRow[]>([{ name: 'Credit card', balance: '', ratePct: '20.5', minPayment: '' }]);
  const [extra, setExtra] = useState('200');
  const [method, setMethod] = useState('avalanche');
  const [consolidate, setConsolidate] = useState(false);
  const [consRate, setConsRate] = useState('12');
  const [consYears, setConsYears] = useState('5');
  const [consFee, setConsFee] = useState('');

  const ready = debts.filter((d) => d.name.trim() && num(d.balance) > 0);
  const result = useCalc<Result>(strategyApi.investing.debts, {
    debts: ready.map((d) => ({ name: d.name.trim(), balance: num(d.balance), ratePct: num(d.ratePct), minPayment: opt(d.minPayment) })),
    extraMonthly: opt(extra), method,
    ...(consolidate ? { consolidationRatePct: num(consRate), consolidationYears: num(consYears, 5), consolidationFee: opt(consFee) } : {}),
  }, ready.length > 0);

  const update = (i: number, key: keyof DebtRow, value: string) => setDebts((rows) => rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <CreditCard className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Debts</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">Paid off, in the right order</h1>
          <p className="mt-1 max-w-2xl text-slate-500 dark:text-slate-400">Every card and loan, the order that costs least, the month each one clears, and a straight answer on consolidating.</p>
        </div>
        <Link href="/dashboard/finance/tax/plan#help" className="btn-secondary inline-flex items-center gap-2">The HELP debt</Link>
      </div>

      <Panel icon={CreditCard} title="What you owe" intro="Cards, personal loans, car loans, buy-now-pay-later. Not the mortgage, and not HELP; those have their own pages.">
        <div className="space-y-3">
          {debts.map((d, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
              <Field label="Debt"><input value={d.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="e.g. Visa, car loan" className={inputClass} /></Field>
              <Field label="Balance"><NumberInput value={d.balance} onChange={(v) => update(i, 'balance', v)} prefix="$" /></Field>
              <Field label="Rate"><NumberInput value={d.ratePct} onChange={(v) => update(i, 'ratePct', v)} suffix="%" step={0.1} /></Field>
              <Field label="Minimum, a month" hint="Blank uses the usual minimum."><NumberInput value={d.minPayment} onChange={(v) => update(i, 'minPayment', v)} prefix="$" /></Field>
              <button type="button" onClick={() => setDebts((rows) => rows.filter((_, j) => j !== i))} disabled={debts.length === 1} className="mb-1 rounded-md p-2 text-slate-400 hover:text-rose-500 disabled:opacity-30" aria-label={`Remove ${d.name || 'debt'}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setDebts((rows) => [...rows, EMPTY])} disabled={debts.length >= 12} className="btn-ghost inline-flex items-center gap-2 text-sm"><Plus className="h-4 w-4" /> Another debt</button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Field label="Extra you can put in, a month" hint="On top of the minimums; it rolls from debt to debt."><NumberInput value={extra} onChange={setExtra} prefix="$" /></Field>
          <Field label="Order"><SelectInput value={method} onChange={setMethod} options={[{ value: 'avalanche', label: 'Highest rate first (cheapest)' }, { value: 'snowball', label: 'Smallest balance first (quick wins)' }]} /></Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={consolidate} onChange={(e) => setConsolidate(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-rose-500" /> Compare a consolidation loan</label>
          </div>
        </div>
        {consolidate && (
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Field label="Consolidation rate"><NumberInput value={consRate} onChange={setConsRate} suffix="%" step={0.1} /></Field>
            <Field label="Over"><NumberInput value={consYears} onChange={setConsYears} suffix="yrs" min={1} max={30} /></Field>
            <Field label="Establishment fee"><NumberInput value={consFee} onChange={setConsFee} prefix="$" /></Field>
          </div>
        )}
      </Panel>

      {ready.length > 0 && (
        <Pending loading={result.loading} error={result.error}>
          {result.result && (
            <div className="space-y-6">
              <Panel title="When it is gone" intro={`${aud(result.result.totalBalance)} owed at an average ${pct(result.result.weightedRatePct, 1)}. Minimums alone are ${aud(result.result.minimumsTotal)} a month.`}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Debt-free in" value={months(result.result.chosen.months)} sub={`paying ${aud(result.result.chosen.monthlyOutlay)} a month`} tone="good" big />
                  <Stat label="Interest along the way" value={aud(result.result.chosen.totalInterest)} sub={`${aud(result.result.chosen.totalPaid)} paid in all`} tone="rose" />
                  <Stat label={result.result.other.method === 'avalanche' ? 'Highest rate first instead' : 'Smallest balance first instead'} value={months(result.result.other.months)} sub={`${aud(result.result.other.totalInterest)} in interest`} />
                  <Stat label="The difference" value={aud(Math.abs(result.result.chosen.totalInterest - result.result.other.totalInterest))} sub={result.result.chosen.totalInterest <= result.result.other.totalInterest ? 'your order costs less' : 'the price of the quicker wins'} tone={result.result.chosen.totalInterest <= result.result.other.totalInterest ? 'plain' : 'warn'} />
                </div>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">The order</h3>
                    <ol className="mt-2 space-y-1.5 text-sm">
                      {result.result.chosen.order.map((o, i) => (
                        <li key={o.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                          <span className="text-slate-800 dark:text-slate-200"><span className="mr-2 text-xs text-slate-400">{i + 1}</span>{o.name}</span>
                          <span className={cn('text-xs', o.clearedMonth === null ? 'text-amber-600' : 'text-slate-500')}>{o.clearedMonth === null ? 'not cleared' : `cleared month ${o.clearedMonth}`} · {aud(o.interest)} interest</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Balance over time</h3>
                    <div className="mt-2"><LineChart series={[{ label: 'Your order', color: '#f43f5e', values: result.result.chosen.series.map((p) => p.balance) }, { label: 'The other order', color: '#a855f7', values: result.result.other.series.map((p) => p.balance) }]} labels={result.result.chosen.series.map((p) => `M${p.month}`)} height={150} /></div>
                  </div>
                </div>
                {result.result.consolidation && (
                  <div className={cn('mt-5 rounded-xl p-4', result.result.consolidation.savesVsPlan > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20')}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">One loan instead</p>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{aud(result.result.consolidation.repayment)} a month for {result.result.consolidation.months} months, {aud(result.result.consolidation.totalInterest)} in interest and fees.</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{result.result.consolidation.verdict}</p>
                  </div>
                )}
                <Notes items={result.result.notes} />
              </Panel>
            </div>
          )}
        </Pending>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Disclaimer asAt={result.result?.asAt} />
        <Link href="/dashboard/finance/invest#emergency" className="text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">Then the safety net</Link>
      </div>
    </div>
  );
}

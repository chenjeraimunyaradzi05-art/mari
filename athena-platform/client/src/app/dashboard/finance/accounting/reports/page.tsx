'use client';

/**
 * The two statements a small business actually asks for: profit and loss
 * over a period, and the balance sheet as at a date. Both read the posted
 * journals; both can be saved as CSV for the accountant.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { downloadText } from '@/lib/download';
import { cn } from '@/lib/utils';

type Row = { accountId: string; code: string | null; name: string; type: string; amount: number };
type ProfitAndLoss = { period: { from: string | null; to: string | null }; revenue: Row[]; expenses: Row[]; totalRevenue: number; totalExpenses: number; netProfit: number };
type BalanceSheet = { asOf: string | null; assets: Row[]; liabilities: Row[]; equity: Row[]; retainedEarnings: number; totalAssets: number; totalLiabilities: number; totalEquity: number; difference: number };

const aud = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);

// The Australian financial year runs 1 July to 30 June.
function financialYear(today = new Date()): { from: string; to: string } {
  const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return { from: `${startYear}-07-01`, to: `${startYear + 1}-06-30` };
}

const csvRow = (cells: Array<string | number>) => cells.map((c) => (typeof c === 'number' ? c.toFixed(2) : `"${String(c).replace(/"/g, '""')}"`)).join(',');

export default function AccountingReportsPage() {
  const searchParams = useSearchParams();
  const organizationId = searchParams.get('organizationId') ?? undefined;
  const fy = financialYear();
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState<'pnl' | 'balance'>('pnl');

  const pnl = useQuery({
    queryKey: ['accounting-pnl', organizationId, from, to],
    queryFn: () => api.get('/accounting/reports/profit-and-loss', { params: { organizationId, from, to } }),
    select: (r) => r.data?.data as ProfitAndLoss,
    enabled: tab === 'pnl' && Boolean(from && to),
  });
  const balance = useQuery({
    queryKey: ['accounting-balance', organizationId, asOf],
    queryFn: () => api.get('/accounting/reports/balance-sheet', { params: { organizationId, asOf } }),
    select: (r) => r.data?.data as BalanceSheet,
    enabled: tab === 'balance' && Boolean(asOf),
  });

  const exportPnl = () => {
    if (!pnl.data) return;
    const lines = [
      csvRow(['Profit and loss', `${from} to ${to}`]),
      csvRow(['Revenue', '']),
      ...pnl.data.revenue.map((r) => csvRow([`${r.code ? `${r.code} ` : ''}${r.name}`, r.amount])),
      csvRow(['Total revenue', pnl.data.totalRevenue]),
      csvRow(['Expenses', '']),
      ...pnl.data.expenses.map((r) => csvRow([`${r.code ? `${r.code} ` : ''}${r.name}`, r.amount])),
      csvRow(['Total expenses', pnl.data.totalExpenses]),
      csvRow(['Net profit', pnl.data.netProfit]),
    ];
    downloadText(`profit-and-loss-${from}-to-${to}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
  };
  const exportBalance = () => {
    if (!balance.data) return;
    const section = (title: string, rows: Row[], total: number) => [csvRow([title, '']), ...rows.map((r) => csvRow([`${r.code ? `${r.code} ` : ''}${r.name}`, r.amount])), csvRow([`Total ${title.toLowerCase()}`, total])];
    const lines = [
      csvRow(['Balance sheet', `as at ${asOf}`]),
      ...section('Assets', balance.data.assets, balance.data.totalAssets),
      ...section('Liabilities', balance.data.liabilities, balance.data.totalLiabilities),
      ...section('Equity', [...balance.data.equity, { accountId: 'retained', code: null, name: 'Retained earnings', type: 'EQUITY', amount: balance.data.retainedEarnings }], balance.data.totalEquity),
    ];
    downloadText(`balance-sheet-${asOf}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
  };

  const Table = ({ title, rows, total }: { title: string; rows: Row[]; total: number }) => (
    <div className="mb-4">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">Nothing posted here.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.accountId}>
                <td className="py-1.5 text-slate-700 dark:text-slate-300">
                  {r.code && <span className="mr-2 text-slate-400">{r.code}</span>}
                  {r.name}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-900 dark:text-white">{aud(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-1 flex justify-between border-t border-slate-200 pt-1.5 text-sm font-semibold dark:border-slate-700">
        <span>Total {title.toLowerCase()}</span>
        <span className="tabular-nums">{aud(total)}</span>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <Link href="/dashboard/finance/accounting" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        <ArrowLeft className="mr-2 h-4 w-4" /> Accounting
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">From your posted journals. Drafts and voided entries are left out.</p>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 w-fit" role="tablist">
        {(
          [
            ['pnl', 'Profit and loss'],
            ['balance', 'Balance sheet'],
          ] as Array<['pnl' | 'balance', string]>
        ).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', tab === v ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300')}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'pnl' ? (
        <section className="card">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input mt-1 block text-sm" />
            </label>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input mt-1 block text-sm" />
            </label>
            <button type="button" onClick={() => { setFrom(fy.from); setTo(fy.to); }} className="text-sm text-primary-600 hover:underline">
              This financial year
            </button>
            <button type="button" onClick={exportPnl} disabled={!pnl.data} className="btn-outline ml-auto inline-flex items-center gap-1 text-sm">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
          {pnl.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : pnl.isError ? (
            <p className="py-6 text-center text-sm text-slate-500">Could not load the report. You may not have access to these books.</p>
          ) : pnl.data ? (
            <>
              <Table title="Revenue" rows={pnl.data.revenue} total={pnl.data.totalRevenue} />
              <Table title="Expenses" rows={pnl.data.expenses} total={pnl.data.totalExpenses} />
              <div className={cn('mt-2 flex justify-between rounded-lg px-3 py-2 text-base font-bold', pnl.data.netProfit >= 0 ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200')}>
                <span>{pnl.data.netProfit >= 0 ? 'Net profit' : 'Net loss'}</span>
                <span className="tabular-nums">{aud(Math.abs(pnl.data.netProfit))}</span>
              </div>
            </>
          ) : null}
        </section>
      ) : (
        <section className="card">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-600 dark:text-slate-300">
              As at
              <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="input mt-1 block text-sm" />
            </label>
            <button type="button" onClick={exportBalance} disabled={!balance.data} className="btn-outline ml-auto inline-flex items-center gap-1 text-sm">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
          {balance.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : balance.isError ? (
            <p className="py-6 text-center text-sm text-slate-500">Could not load the report. You may not have access to these books.</p>
          ) : balance.data ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Table title="Assets" rows={balance.data.assets} total={balance.data.totalAssets} />
              </div>
              <div>
                <Table title="Liabilities" rows={balance.data.liabilities} total={balance.data.totalLiabilities} />
                <Table title="Equity" rows={[...balance.data.equity, { accountId: 'retained', code: null, name: 'Retained earnings', type: 'EQUITY', amount: balance.data.retainedEarnings }]} total={balance.data.totalEquity} />
              </div>
              <p className={cn('md:col-span-2 text-xs', balance.data.difference === 0 ? 'text-slate-500' : 'text-red-600')}>
                {balance.data.difference === 0 ? 'Assets equal liabilities plus equity.' : `Out of balance by ${aud(balance.data.difference)}: an entry was posted unbalanced.`}
              </p>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

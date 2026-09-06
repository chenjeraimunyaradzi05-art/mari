'use client';

/**
 * Bank feeds. Connect a bank by consent when the provider is configured,
 * or paste a statement export; then put each line against a ledger account
 * and post it as a journal entry.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Landmark, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type LedgerAccount = { id: string; name: string; code: string | null; type: string };
type BankAccount = { id: string; name: string; accountNumber: string | null; bsb: string | null; type: string | null; currency: string; balanceCents: number; ledgerAccountId: string | null; ledgerAccount: { id: string; name: string; code: string | null } | null; _count: { transactions: number } };
type Connection = { id: string; provider: 'BASIQ' | 'CSV'; institution: string; status: string; lastSyncedAt: string | null; lastError: string | null; accounts: BankAccount[] };
type Status = { configured: boolean; connections: Connection[] };
type TxStatus = 'UNREVIEWED' | 'CATEGORISED' | 'POSTED' | 'IGNORED';
type Transaction = { id: string; postedAt: string; description: string; amountCents: number; category: string | null; status: TxStatus; ledgerAccountId: string | null; note: string | null; bankAccount: { id: string; name: string; ledgerAccountId: string | null }; suggestedLedgerAccountId: string | null };

const aud = (cents: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);
const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const TONE: Record<TxStatus, string> = { UNREVIEWED: 'bg-amber-100 text-amber-800', CATEGORISED: 'bg-blue-100 text-blue-800', POSTED: 'bg-emerald-100 text-emerald-800', IGNORED: 'bg-slate-100 text-slate-600' };

/** Lines of a pasted statement, comma or tab separated, quotes respected, header row dropped. */
function parseStatement(text: string): Array<{ date: string; description: string; amount: string; balance?: string }> {
  const splitLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let quoted = false;
    const separator = line.includes('\t') ? '\t' : ',';
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === separator && !quoted) {
        cells.push(current.trim());
        current = '';
      } else current += ch;
    }
    cells.push(current.trim());
    return cells;
  };
  const looksLikeDate = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}$/.test(s);
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitLine)
    .filter((cells) => cells.length >= 3 && looksLikeDate(cells[0]))
    .map((cells) => {
      // date, description, amount[, balance]  or  date, description, debit, credit[, balance]
      if (cells.length >= 4 && cells[2] !== '' && cells[3] !== '' && !Number.isNaN(Number(cells[2].replace(/[^0-9.-]/g, ''))) && !Number.isNaN(Number(cells[3].replace(/[^0-9.-]/g, '')))) {
        const debit = Number(cells[2].replace(/[^0-9.-]/g, '')) || 0;
        const credit = Number(cells[3].replace(/[^0-9.-]/g, '')) || 0;
        if (debit && credit) return { date: cells[0], description: cells[1], amount: cells[2], balance: cells[3] };
        return { date: cells[0], description: cells[1], amount: String(credit - debit), balance: cells[4] };
      }
      return { date: cells[0], description: cells[1], amount: cells[2], balance: cells[3] };
    });
}

export default function BankingPage() {
  const queryClient = useQueryClient();
  const [accountName, setAccountName] = useState('');
  const [pasted, setPasted] = useState('');
  const [importing, setImporting] = useState(false);
  const [accountFilter, setAccountFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | TxStatus>('UNREVIEWED');

  const status = useQuery({ queryKey: ['banking-status'], queryFn: () => api.get('/banking/status'), select: (r) => r.data?.data as Status });
  const ledger = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts'),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as LedgerAccount[]) : []),
  });
  const transactions = useQuery({
    queryKey: ['banking-transactions', accountFilter, statusFilter],
    queryFn: () => api.get('/banking/transactions', { params: { ...(accountFilter ? { accountId: accountFilter } : {}), ...(statusFilter ? { status: statusFilter } : {}), limit: 300 } }),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Transaction[]) : []),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['banking-status'] });
    queryClient.invalidateQueries({ queryKey: ['banking-transactions'] });
  };
  const onError = (e: unknown) => toast.error(errorMessage(e) || 'That did not work');

  const connect = useMutation({
    mutationFn: () => api.post('/banking/connect'),
    onSuccess: (res) => {
      const url = res.data?.data?.consentUrl;
      if (url) window.open(url, '_blank', 'noopener');
      toast.success('Finish the consent on the bank page, then sync');
      refresh();
    },
    onError,
  });
  const sync = useMutation({
    mutationFn: () => api.post('/banking/sync'),
    onSuccess: (res) => {
      const d = res.data?.data ?? {};
      toast.success(`${d.accounts ?? 0} accounts, ${d.transactionsImported ?? 0} new lines`);
      refresh();
    },
    onError,
  });
  const importRows = useMutation({
    mutationFn: () => api.post('/banking/import', { accountName: accountName.trim() || 'Imported account', rows: parseStatement(pasted) }),
    onSuccess: (res) => {
      const d = res.data?.data ?? {};
      toast.success(`${d.imported ?? 0} imported, ${d.duplicates ?? 0} already there, ${d.skipped ?? 0} unreadable`);
      setPasted('');
      setImporting(false);
      refresh();
    },
    onError,
  });
  const link = useMutation({
    mutationFn: ({ id, ledgerAccountId }: { id: string; ledgerAccountId: string | null }) => api.post(`/banking/accounts/${id}/link`, { ledgerAccountId }),
    onSuccess: () => {
      toast.success('Linked');
      refresh();
    },
    onError,
  });
  const categorise = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/banking/transactions/${id}`, data),
    onSuccess: refresh,
    onError,
  });
  const post = useMutation({
    mutationFn: (id: string) => api.post(`/banking/transactions/${id}/post`),
    onSuccess: () => {
      toast.success('Posted to the ledger');
      refresh();
    },
    onError,
  });
  const postAll = useMutation({
    mutationFn: () => api.post('/banking/transactions/post-all', accountFilter ? { accountId: accountFilter } : {}),
    onSuccess: (res) => {
      const d = res.data?.data ?? {};
      toast.success(`${d.posted ?? 0} posted${d.failed?.length ? `, ${d.failed.length} could not be` : ''}`);
      refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/banking/connections/${id}`),
    onSuccess: refresh,
    onError,
  });

  const bankAccounts = useMemo(() => (status.data?.connections ?? []).flatMap((c) => c.accounts.map((a) => ({ ...a, institution: c.institution }))), [status.data]);
  const bankLedgerOptions = (ledger.data ?? []).filter((a) => a.type === 'ASSET' || a.type === 'LIABILITY');
  const counterOptions = ledger.data ?? [];
  const parsedCount = pasted.trim() ? parseStatement(pasted).length : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Link href="/dashboard/finance" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Finance hub
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Landmark className="h-7 w-7 text-primary-600" /> Bank feeds
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Bank lines in, ledger entries out. Your bank login never touches ATHENA.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status.data?.configured ? (
            <>
              <button type="button" onClick={() => connect.mutate()} disabled={connect.isPending} className="btn-primary text-sm">
                Connect a bank
              </button>
              <button type="button" onClick={() => sync.mutate()} disabled={sync.isPending} className="btn-outline inline-flex items-center gap-1 text-sm">
                <RefreshCw className={cn('h-4 w-4', sync.isPending && 'animate-spin')} /> Sync
              </button>
            </>
          ) : null}
          <button type="button" onClick={() => setImporting((v) => !v)} className="btn-outline inline-flex items-center gap-1 text-sm">
            <Upload className="h-4 w-4" /> Paste a statement
          </button>
        </div>
      </div>

      {status.data && !status.data.configured && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          Live bank feeds are not switched on for this server. Export a statement from your bank (CSV) and paste it in; the result is the same.
        </p>
      )}

      {importing && (
        <div className="card space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            One line per transaction: date, description, amount, and optionally the running balance. Debit and credit columns are understood. Dates day-first or ISO. The same line pasted twice is kept once.
          </p>
          <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Which account is this? e.g. Everyday account" aria-label="Account name" className="input w-full text-sm" />
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={8} placeholder={'Date,Description,Amount,Balance\n01/07/2026,Coffee,-4.50,1195.50\n02/07/2026,Client payment,1200.00,2395.50'} aria-label="Statement rows" className="input w-full font-mono text-xs" />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => importRows.mutate()} disabled={importRows.isPending || parsedCount === 0} className="btn-primary text-sm">
              Import {parsedCount ? `${parsedCount} lines` : ''}
            </button>
            <button type="button" onClick={() => setImporting(false)} className="text-sm text-slate-500 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">Accounts</h2>
        {status.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : bankAccounts.length === 0 ? (
          <p className="card text-sm text-slate-500">No bank accounts yet. Connect a bank or paste a statement.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {bankAccounts.map((a) => (
              <div key={a.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-white">{a.name}</p>
                    <p className="text-xs text-slate-500">
                      {a.institution}
                      {a.bsb ? ` · BSB ${a.bsb}` : ''}
                      {a.accountNumber ? ` · ${a.accountNumber}` : ''} · {a._count.transactions} lines
                    </p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{aud(a.balanceCents)}</p>
                </div>
                <label className="block text-xs text-slate-500">
                  Ledger account for this bank account
                  <select value={a.ledgerAccountId ?? ''} onChange={(e) => link.mutate({ id: a.id, ledgerAccountId: e.target.value || null })} className="input mt-1 w-full text-sm">
                    <option value="">Not linked (posting needs this)</option>
                    {bankLedgerOptions.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code ? `${l.code} · ` : ''}
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        )}
        {(status.data?.connections ?? []).length > 0 && (
          <ul className="flex flex-wrap gap-2 text-xs text-slate-500">
            {status.data!.connections.map((c) => (
              <li key={c.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 dark:border-slate-700">
                {c.institution} · {c.status.toLowerCase()}
                {c.lastSyncedAt ? ` · synced ${new Date(c.lastSyncedAt).toLocaleDateString('en-AU')}` : ''}
                {c.lastError ? <span className="text-red-600">{c.lastError}</span> : null}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Remove ${c.institution} and its ${c.accounts.length} account(s)? Posted journals stay.`)) remove.mutate(c.id);
                  }}
                  className="text-slate-400 hover:text-red-600"
                  aria-label={`Remove ${c.institution}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900 dark:text-white">Transactions</h2>
          <div className="flex flex-wrap gap-2">
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} aria-label="Bank account" className="input text-sm">
              <option value="">All accounts</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | TxStatus)} aria-label="Status" className="input text-sm">
              <option value="">All statuses</option>
              {(['UNREVIEWED', 'CATEGORISED', 'POSTED', 'IGNORED'] as TxStatus[]).map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => postAll.mutate()} disabled={postAll.isPending} className="btn-outline text-sm">
              Post all categorised
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {transactions.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (transactions.data?.length ?? 0) === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Nothing here.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.data!.map((t) => {
                  const chosen = t.ledgerAccountId ?? '';
                  const suggestion = !chosen && t.suggestedLedgerAccountId ? counterOptions.find((a) => a.id === t.suggestedLedgerAccountId) : null;
                  return (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500">{new Date(t.postedAt).toLocaleDateString('en-AU')}</td>
                      <td className="px-3 py-2">
                        <div className="text-slate-900 dark:text-white">{t.description}</div>
                        <div className="text-xs text-slate-500">
                          {t.bankAccount.name}
                          {t.category ? ` · ${t.category}` : ''}
                        </div>
                      </td>
                      <td className={cn('whitespace-nowrap px-3 py-2 text-right tabular-nums', t.amountCents < 0 ? 'text-slate-900 dark:text-white' : 'text-emerald-700')}>{aud(t.amountCents)}</td>
                      <td className="px-3 py-2">
                        {t.status === 'POSTED' ? (
                          <span className="text-slate-600 dark:text-slate-300">{counterOptions.find((a) => a.id === chosen)?.name ?? 'Posted'}</span>
                        ) : (
                          <select value={chosen} onChange={(e) => categorise.mutate({ id: t.id, data: { ledgerAccountId: e.target.value || null } })} aria-label="Ledger account" className="input min-w-[180px] text-sm">
                            <option value="">{suggestion ? `Suggested: ${suggestion.name}` : 'Choose an account'}</option>
                            {counterOptions.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code ? `${a.code} · ` : ''}
                                {a.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {suggestion && (
                          <button type="button" onClick={() => categorise.mutate({ id: t.id, data: { ledgerAccountId: suggestion.id } })} className="mt-1 block text-xs text-primary-600 hover:underline">
                            Use suggestion
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TONE[t.status])}>{t.status.toLowerCase()}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                        {t.status === 'CATEGORISED' && (
                          <button type="button" onClick={() => post.mutate(t.id)} disabled={post.isPending} className="mr-2 text-primary-600 hover:underline">
                            Post
                          </button>
                        )}
                        {t.status !== 'POSTED' && t.status !== 'IGNORED' && (
                          <button type="button" onClick={() => categorise.mutate({ id: t.id, data: { status: 'IGNORED' } })} className="text-slate-500 hover:underline">
                            Ignore
                          </button>
                        )}
                        {t.status === 'IGNORED' && (
                          <button type="button" onClick={() => categorise.mutate({ id: t.id, data: { status: 'UNREVIEWED' } })} className="text-slate-500 hover:underline">
                            Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

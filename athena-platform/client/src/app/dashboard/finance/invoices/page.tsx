'use client';

/**
 * The tax invoices ATHENA has issued to this member: subscriptions, the
 * formation fee, a cohort place. Each one downloads as a PDF for the
 * records the record-keeping guide asks her to keep for five years.
 */

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Loader2, Receipt } from 'lucide-react';
import { invoiceApi } from '@/lib/api';
import { apiMessage } from '@/lib/strategy-api';
import { downloadBlob } from '@/lib/download';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type Invoice = {
  id: string;
  invoiceNumber: string;
  amount: string | number;
  currency: string;
  status: string;
  issuedAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

const TONE: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  SENT: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  OVERDUE: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
  CANCELLED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export default function InvoicesPage() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const invoices = useQuery({
    queryKey: ['invoices'],
    queryFn: invoiceApi.list,
    select: (r) => (r.data?.data ?? []) as Invoice[],
  });

  const download = async (invoice: Invoice) => {
    setDownloading(invoice.id);
    try {
      const res = await invoiceApi.pdf(invoice.id);
      downloadBlob(`${invoice.invoiceNumber}.pdf`, res.data as Blob);
    } catch (err) {
      toast.error(apiMessage(err, 'That invoice could not be downloaded.'));
    } finally {
      setDownloading(null);
    }
  };

  const rows = invoices.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Receipt className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Invoices</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">What ATHENA has charged you</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Membership, a formation fee, a cohort place. Each is a tax invoice you can claim if the spend was for work.</p>
        </div>
        <Link href="/dashboard/finance" className="btn-secondary">Finance hub</Link>
      </div>

      {invoices.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : invoices.isError ? (
        <p className="rounded-2xl border border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Invoices could not be loaded just now.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 p-8 text-center dark:border-slate-800">
          <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-white">No invoices yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">One appears here when you take out a membership or pay a fee.</p>
          <Link href="/pricing" className="mt-4 inline-block text-sm font-semibold text-rose-600 hover:underline dark:text-rose-400">See what membership costs</Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {rows.map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 dark:text-white">{invoice.invoiceNumber}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {invoice.issuedAt ? `Issued ${formatDate(invoice.issuedAt)}` : `Created ${formatDate(invoice.createdAt)}`}
                  {invoice.paidAt ? ` · paid ${formatDate(invoice.paidAt)}` : invoice.dueAt ? ` · due ${formatDate(invoice.dueAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', TONE[invoice.status] ?? TONE.DRAFT)}>{invoice.status.toLowerCase()}</span>
                <span className="tabular-nums font-semibold text-slate-900 dark:text-white">{formatCurrency(Number(invoice.amount), invoice.currency)}</span>
                <button type="button" onClick={() => download(invoice)} disabled={downloading === invoice.id} className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline dark:text-rose-400" aria-label={`Download ${invoice.invoiceNumber}`}>
                  {downloading === invoice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        These are what the platform charged you. Invoices you issue to your own customers live in the <Link href="/dashboard/finance/accounting" className="font-medium text-rose-600 hover:underline dark:text-rose-400">ledger</Link>.
      </p>
    </div>
  );
}

'use client';

/**
 * What a business registration costs, and what the fee is for.
 *
 * The amount was shown at the last step only, on the payment form, after the
 * applicant had chosen a structure, named the business and filled in the
 * details. The type picker and the formation landing page printed no price, and
 * no page said what the fee covers or what happens to it if the registration is
 * refused. Everything here comes from GET /api/formation/fees, which reads the
 * same table the payment step charges from, so the price on a card and the price
 * on the payment form cannot differ, and the wording is the server's: a page
 * adds no figure and no promise of its own.
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formationApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export interface FormationFee {
  type: string;
  amountCents: number;
  amount: number;
}

export interface FormationFeeBook {
  currency: string;
  fees: FormationFee[];
  /** The one GST sentence a price is printed beside, or null when none should be. */
  gst?: { registered: boolean; statement: string } | null;
  terms: {
    covers: string[];
    notCovered: string[];
    refund: string[];
    timing: string;
  };
}

export const FORMATION_TYPE_LABEL: Record<string, string> = {
  SOLE_TRADER: 'Sole trader',
  PARTNERSHIP: 'Partnership',
  COMPANY: 'Company (Pty Ltd)',
  TRUST: 'Trust',
};

export function useFormationFees() {
  return useQuery({
    queryKey: ['formation', 'fees'],
    queryFn: async () => {
      const { data } = await formationApi.fees();
      return data.data as FormationFeeBook;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** The fee for one structure as a price, or null when the server did not give one. */
export function formationFeeLabel(book: FormationFeeBook | undefined, type: string): string | null {
  const fee = book?.fees.find((candidate) => candidate.type === type);
  if (!fee) return null;
  return formatCurrency(fee.amount, book?.currency ?? 'AUD');
}

/** One price per structure, for the landing page. */
export function FormationFeeList() {
  const fees = useFormationFees();

  if (fees.isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" aria-hidden="true" />;
  }
  if (fees.isError || !fees.data) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        We could not load the fees just now. The fee for your structure is always shown before you pay.
      </p>
    );
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {fees.data.fees.map((fee) => (
        <div key={fee.type} className="flex items-baseline justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <dt className="text-sm font-medium text-slate-700 dark:text-slate-200">{FORMATION_TYPE_LABEL[fee.type] ?? fee.type}</dt>
          <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{formationFeeLabel(fees.data, fee.type)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Lines({ heading, lines }: { heading: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{heading}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/** What the fee covers, what it does not, and what happens if the registration does not go ahead. */
export function FormationFeeTerms({ className = '' }: { className?: string }) {
  const fees = useFormationFees();
  const terms = fees.data?.terms;

  // Nothing is invented while the server has not answered: the terms are the
  // server's words, and without them the section is simply not drawn.
  if (!terms) return null;

  return (
    <section aria-labelledby="formation-fee-terms" className={`space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <h2 id="formation-fee-terms" className="text-base font-semibold text-slate-900 dark:text-white">
        What the fee is for
      </h2>
      <Lines heading="What it covers" lines={terms.covers} />
      <Lines heading="What it does not cover" lines={terms.notCovered} />
      <Lines heading="If it does not go ahead" lines={terms.refund} />
      <p className="text-sm text-slate-600 dark:text-slate-300">{terms.timing}</p>
      {fees.data?.gst?.statement && <p className="text-xs text-slate-500 dark:text-slate-400">{fees.data.gst.statement}</p>}
      <p className="text-sm">
        <Link href="/help" className="font-medium text-rose-600 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-400">
          Questions about the fee? Ask support
        </Link>
      </p>
    </section>
  );
}

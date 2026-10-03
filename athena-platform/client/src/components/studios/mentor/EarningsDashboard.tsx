'use client';

/**
 * Earnings Dashboard
 * Phase 4: Web Client - Persona Studios
 *
 * What a mentor or seller has been paid through ATHENA's escrow, what is still
 * held, what Stripe will let her withdraw, and where it goes.
 *
 * Every figure here is read from GET /api/connect/earnings, in the currency the
 * server names. This screen used to put a "$" in front of every number whatever
 * the currency, divide every amount by a hundred (so a yen balance read a
 * hundredth of itself), show a zero balance when Stripe could not be asked,
 * count "sessions" and draw the chart from the twenty most recent rows, and
 * list cancelled holds as pending money. It also carried a tax-documents card
 * that said tax documents were not connected, an Export button that exported
 * nothing and a date-range picker fixed at thirty days. Those are built now:
 * the Payments tab reads any range a page at a time, and the Statement tab
 * gives her each Australian financial year's figures and the same as a CSV.
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, connectApi, mentorApi } from '@/lib/api';
import { downloadBlob } from '@/lib/download';
import { cn, getPreferredLocale } from '@/lib/utils';
import {
  TrendingUp,
  CreditCard,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Wallet,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ============================================
// TYPES
// ============================================

type StatusColor = 'emerald' | 'yellow' | 'blue' | 'red' | 'zinc';

interface Transaction {
  id: string;
  description: string;
  /** In major units of `currency`. */
  amount: number;
  currency: string;
  statusLabel: string;
  statusColor: StatusColor;
  /** Whether this money reached her, is still on its way, or never will. */
  outcome: 'paid' | 'held' | 'gone';
  date: Date;
}

// Mirrors the payout methods the Connect API returns. These are Stripe
// external accounts, so `isDefault` is per-currency rather than one overall.
interface PayoutMethod {
  id: string;
  type: 'bank' | 'card';
  name: string;
  last4?: string | null;
  currency?: string | null;
  isDefault: boolean;
}

/** What `GET /api/connect/earnings` returns. Amounts are in minor units. */
interface EarningsResponse {
  /** The currency the flat totals are counted in. */
  currency: string;
  totalEarnings: number;
  pendingPayouts: number;
  /** Null when Stripe could not be asked; see `balanceUnavailable`. */
  availableBalance: number | null;
  balanceUnavailable: boolean;
  byCurrency: {
    currency: string;
    totalEarnings: number;
    pendingPayouts: number;
    completedCount: number;
  }[];
  /** Captured earnings per Queensland month, last twelve months, every currency. */
  monthly: { month: string; currency: string; earnings: number; count: number }[];
  recentTransactions: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    description: string | null;
    createdAt: string;
    capturedAt: string | null;
  }[];
}

/** What `GET /api/connect/account` reports back from Stripe. */
interface ConnectAccountStatus {
  isOnboarded: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  requirements?: string[];
}

// ============================================
// MONEY
// ============================================

/**
 * How many of a currency's smallest unit Stripe counts to one whole unit.
 * Mirrors minorUnitScale in server/src/services/stripe-connect.service.ts, so
 * the balance offered here is the one the payout route will accept. Dividing
 * everything by a hundred, as this screen used to, showed a ¥15,000 balance as
 * ¥150.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

export function minorUnitScale(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 1;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 1000;
  return 100;
}

export const fromMinorUnits = (amount: number, currency: string) =>
  Math.round(amount) / minorUnitScale(currency);

/** A$1,250.00, NZ$40.00, ¥15,000: the currency's own symbol and precision. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(getPreferredLocale(), { style: 'currency', currency }).format(amount);
  } catch {
    // A code Intl does not know is still shown as what it is, never as dollars.
    return `${amount.toLocaleString()} ${currency}`;
  }
}

/**
 * Escrow statuses as she should read them. The server writes CANCELED and
 * REFUNDED; this table used to key "CANCELLED", matched neither, and fell back
 * to "pending" — so every hold the expiry sweep cancelled, and every refund,
 * was listed as money still on its way to her.
 */
const ESCROW_STATUS: Record<string, Pick<Transaction, 'statusLabel' | 'statusColor' | 'outcome'>> = {
  CAPTURED: { statusLabel: 'Paid', statusColor: 'emerald', outcome: 'paid' },
  AUTHORIZED: { statusLabel: 'Held', statusColor: 'blue', outcome: 'held' },
  PENDING: { statusLabel: 'Awaiting payment', statusColor: 'yellow', outcome: 'held' },
  CANCELED: { statusLabel: 'Cancelled', statusColor: 'zinc', outcome: 'gone' },
  REFUNDED: { statusLabel: 'Refunded to buyer', statusColor: 'zinc', outcome: 'gone' },
  FAILED: { statusLabel: 'Failed', statusColor: 'red', outcome: 'gone' },
};

/** A status this screen does not know is shown as itself, not guessed into "pending". */
function describeEscrowStatus(status: string): Pick<Transaction, 'statusLabel' | 'statusColor' | 'outcome'> {
  const known = ESCROW_STATUS[status];
  if (known) return known;
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
  return { statusLabel: label, statusColor: 'zinc', outcome: 'held' };
}

// Queensland keeps AEST all year, which is the clock the server buckets
// months by; building the axis on the same clock keeps a payment made at 9am
// on the 1st in the month the server put it in.
const QUEENSLAND_OFFSET_MS = 10 * 60 * 60 * 1000;
const SERIES_MONTHS = 12;

/** The last twelve `YYYY-MM` keys, oldest first, ending with this Queensland month. */
function lastTwelveMonths(now: Date): string[] {
  const local = new Date(now.getTime() + QUEENSLAND_OFFSET_MS);
  const keys: string[] = [];
  for (let back = SERIES_MONTHS - 1; back >= 0; back -= 1) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - back, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(getPreferredLocale(), {
    month: 'short',
    timeZone: 'UTC',
  });
}

const readErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const errorStatus = (error: unknown) =>
  (error as { response?: { status?: number } })?.response?.status;

// ============================================
// COMPONENTS
// ============================================

function StatCard({
  title,
  value,
  note,
  icon: Icon,
}: {
  title: string;
  value: string;
  note?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
          </div>
          <div className={cn(
            'h-12 w-12 rounded-full flex items-center justify-center',
            'bg-emerald-100 dark:bg-emerald-900/30'
          )}>
            <Icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Released earnings per month over the last twelve, in one currency.
 *
 * Drawn from the server's monthly series. It used to be grouped on the client
 * out of the twenty most recent transactions, so a busy mentor's chart covered
 * a few weeks while calling itself an overview, and it split the bars into
 * courses, tips and referrals that nothing ever reported.
 */
function EarningsChart({
  series,
  currency,
}: {
  series: { month: string; earnings: number }[];
  currency: string;
}) {
  const total = series.reduce((sum, m) => sum + m.earnings, 0);
  const maxValue = Math.max(...series.map((m) => m.earnings), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings, last 12 months</CardTitle>
        <CardDescription>
          Released to you each month, after ATHENA&apos;s fee, in {currency}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {total <= 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No payments in {currency} have been released to you in the last 12 months.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end justify-between h-48 gap-2">
              {series.map((m) => {
                const height = maxValue > 0 ? (m.earnings / maxValue) * 100 : 0;
                return (
                  <div key={m.month} className="flex-1 flex h-full flex-col items-center justify-end gap-1">
                    <div
                      className="w-full rounded-t-sm bg-emerald-500"
                      style={{ height: `${height}%` }}
                      title={`${monthLabel(m.month)}: ${formatMoney(m.earnings, currency)}`}
                    />
                    <span className="text-xs text-muted-foreground">{monthLabel(m.month)}</span>
                  </div>
                );
              })}
            </div>

            <Separator />

            <div className="text-center">
              <p className="text-2xl font-bold">{formatMoney(total, currency)}</p>
              <p className="text-sm text-muted-foreground">Released in the last 12 months</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** A transaction row as GET /connect/earnings/transactions returns it. Amounts in minor units. */
interface ApiTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
  capturedAt: string | null;
}

function toTransaction(t: ApiTransaction): Transaction {
  const currency = t.currency.toUpperCase();
  return {
    id: t.id,
    description: t.description || 'Payment',
    amount: fromMinorUnits(t.amount, currency),
    currency,
    ...describeEscrowStatus(t.status),
    date: new Date(t.capturedAt ?? t.createdAt),
  };
}

/** A Queensland calendar day, YYYY-MM-DD, `daysBack` days before today. */
function queenslandDay(daysBack: number, now = new Date()): string {
  const local = new Date(now.getTime() + QUEENSLAND_OFFSET_MS - daysBack * 24 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

const RANGES = {
  all: { label: 'All time', days: null },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
  '12m': { label: 'Last 12 months', days: 365 },
} as const;
type RangeKey = keyof typeof RANGES;

const TRANSACTIONS_PAGE = 20;

/**
 * Her payments over a range she chooses, a page at a time.
 *
 * This used to be the twenty most recent rows off the earnings response, under
 * a date-range picker hard-set to thirty days and disabled. It reads the
 * range from GET /connect/earnings/transactions, which counts Queensland days
 * with both ends included.
 */
function TransactionsPanel() {
  const [range, setRange] = useState<RangeKey>('all');
  const days = RANGES[range].days;

  const query = useInfiniteQuery({
    queryKey: ['connect', 'earnings', 'transactions', range],
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get('/connect/earnings/transactions', {
        params: {
          ...(days !== null ? { from: queenslandDay(days), to: queenslandDay(0) } : {}),
          ...(pageParam ? { cursor: pageParam } : {}),
          limit: TRANSACTIONS_PAGE,
        },
      });
      return data.data as { transactions: ApiTransaction[]; nextCursor: string | null };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const transactions = (query.data?.pages ?? []).flatMap((page) => page.transactions.map(toTransaction));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Payments</CardTitle>
            <CardDescription>Newest first, net of ATHENA&apos;s fee</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="payments-range" className="text-sm text-muted-foreground">
              Showing
            </Label>
            <select
              id="payments-range"
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {(Object.keys(RANGES) as RangeKey[]).map((key) => (
                <option key={key} value={key}>
                  {RANGES[key].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading your payments…</div>
        ) : query.isError ? (
          <div className="py-10 text-center text-sm">
            <p className="font-medium">We could not load your payments.</p>
            <Button variant="outline" className="mt-4" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {range === 'all'
              ? 'Nobody has paid you through ATHENA yet.'
              : `Nobody has paid you through ATHENA in the ${RANGES[range].label.toLowerCase()}.`}
          </div>
        ) : (
          <>
            <TransactionsTable transactions={transactions} />
            {query.hasNextPage && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                >
                  {query.isFetchingNextPage ? 'Loading…' : 'Show more'}
                </Button>
              </div>
            )}
            {query.isFetchNextPageError && (
              <p className="mt-3 text-center text-sm text-red-600">
                The next page did not load. Try again.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="text-muted-foreground">
                  {tx.date.toLocaleDateString(getPreferredLocale(), {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{tx.description}</p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      tx.statusColor === 'emerald' && 'border-emerald-500 text-emerald-600',
                      tx.statusColor === 'yellow' && 'border-yellow-500 text-yellow-600',
                      tx.statusColor === 'blue' && 'border-blue-500 text-blue-600',
                      tx.statusColor === 'red' && 'border-red-500 text-red-600',
                      tx.statusColor === 'zinc' && 'border-zinc-400 text-zinc-500'
                    )}
                  >
                    {tx.statusLabel}
                  </Badge>
                </TableCell>
                <TableCell className={cn(
                  'text-right font-medium',
                  tx.outcome === 'paid' && 'text-emerald-600',
                  // Money that never reached her is shown struck through, so a
                  // cancelled hold cannot be read as an amount she is owed.
                  tx.outcome === 'gone' && 'text-muted-foreground line-through'
                )}>
                  {tx.outcome === 'paid' ? '+' : ''}
                  {formatMoney(tx.amount, tx.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
  );
}

/** What GET /connect/earnings/statement returns. Amounts in minor units. */
interface EarningsStatement {
  financialYear: number;
  label: string;
  generatedAt: string;
  lines: {
    id: string;
    releasedAt: string;
    description: string;
    kind: string;
    currency: string;
    gross: number;
    fee: number;
    net: number;
    status: 'RELEASED' | 'REFUNDED';
    /** How much of `gross` has gone back to the buyer so far. A sale refunded in part is still RELEASED. */
    refunded?: number;
  }[];
  totals: {
    currency: string;
    count: number;
    gross: number;
    fee: number;
    net: number;
    refundedCount: number;
    refundedNet: number;
  }[];
  availableYears: number[];
}

const fyShort = (year: number) => `FY${year - 1}–${String(year).slice(2)}`;

/** What buyers were given back in part, on sales that still count, in one currency. */
const partRefunded = (statement: EarningsStatement, currency: string) =>
  statement.lines
    .filter((line) => line.currency === currency && line.status === 'RELEASED')
    .reduce((sum, line) => sum + (line.refunded ?? 0), 0);

/**
 * Her earnings for an Australian financial year, and the same as a CSV file.
 *
 * In place of a card that said tax document generation was not connected and
 * an Export button that exported nothing. It is exactly what ATHENA's escrow
 * records show — what buyers paid, what ATHENA kept, what reached her — and it
 * says plainly that it is not a tax invoice or advice.
 */
function StatementsPanel() {
  // Undefined until she picks one: the server answers with the current
  // financial year and the list of years she has anything in.
  const [year, setYear] = useState<number | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);

  const query = useQuery({
    queryKey: ['connect', 'earnings', 'statement', year ?? 'current'],
    queryFn: async () => {
      const { data } = await api.get('/connect/earnings/statement', {
        params: year ? { fy: year } : {},
      });
      return data.data as EarningsStatement;
    },
  });

  const statement = query.data;

  const download = async () => {
    if (!statement) return;
    setDownloading(true);
    try {
      const response = await api.get('/connect/earnings/statement', {
        params: { fy: statement.financialYear, format: 'csv' },
        responseType: 'blob',
      });
      downloadBlob(
        `athena-earnings-FY${statement.financialYear - 1}-${String(statement.financialYear).slice(2)}.csv`,
        response.data as Blob
      );
    } catch (error) {
      toast.error(readErrorMessage(error, 'The statement could not be downloaded'));
    } finally {
      setDownloading(false);
    }
  };

  const money = (minor: number, currency: string) => formatMoney(fromMinorUnits(minor, currency), currency);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Earnings statement</CardTitle>
            <CardDescription>
              {statement ? statement.label : 'What ATHENA released to you in an Australian financial year'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {statement && statement.availableYears.length > 0 && (
              <select
                aria-label="Financial year"
                value={statement.financialYear}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {statement.availableYears.map((fy) => (
                  <option key={fy} value={fy}>
                    {fyShort(fy)}
                  </option>
                ))}
              </select>
            )}
            <Button variant="outline" onClick={download} disabled={!statement || downloading}>
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {query.isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading your statement…</div>
        ) : query.isError || !statement ? (
          <div className="py-10 text-center text-sm">
            <p className="font-medium">We could not load your statement.</p>
            <Button variant="outline" className="mt-4" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            {statement.totals.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing was released to you in {fyShort(statement.financialYear)}.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {statement.totals.map((t) => (
                  <div key={t.currency} className="rounded-lg border p-4 space-y-2">
                    <p className="text-sm font-medium">{t.currency}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Paid by buyers</span>
                      <span>{money(t.gross, t.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">ATHENA&apos;s fees</span>
                      <span>{money(t.fee, t.currency)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Paid to you</span>
                      <span>{money(t.net, t.currency)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.count} payment{t.count === 1 ? '' : 's'}
                      {t.refundedCount > 0
                        ? `; ${t.refundedCount} refunded to the buyer after release, ${money(t.refundedNet, t.currency)}, not counted`
                        : ''}
                      {partRefunded(statement, t.currency) > 0
                        ? `; ${money(partRefunded(statement, t.currency), t.currency)} of the figures above went back to buyers in part refunds and is still counted in them`
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {statement.lines.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Released</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Paid by buyer</TableHead>
                    <TableHead className="text-right">ATHENA fee</TableHead>
                    <TableHead className="text-right">Paid to you</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(line.releasedAt).toLocaleDateString(getPreferredLocale(), {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'Australia/Brisbane',
                        })}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{line.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.kind}
                          {line.status === 'REFUNDED' ? ' · refunded to the buyer after release' : ''}
                          {line.status === 'RELEASED' && (line.refunded ?? 0) > 0
                            ? ` · ${money(line.refunded ?? 0, line.currency)} of it refunded to the buyer`
                            : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">{money(line.gross, line.currency)}</TableCell>
                      <TableCell className="text-right">{money(line.fee, line.currency)}</TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-medium',
                          line.status === 'REFUNDED' && 'text-muted-foreground line-through'
                        )}
                      >
                        {money(line.net, line.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <p className="text-xs text-muted-foreground">
              This is a record of payments ATHENA released to you through Stripe, taken from
              ATHENA&apos;s escrow records and counted on Queensland time. It is not a tax invoice and
              not tax advice. Your Stripe dashboard is the record of what reached your bank; a
              registered tax agent or the ATO can tell you how to report this income.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PayoutMethodCard({
  method,
  onSetDefault,
}: {
  method: PayoutMethod;
  onSetDefault: () => void;
}) {
  const TypeIcon = method.type === 'bank' ? Building2 : CreditCard;
  const currency = method.currency ? method.currency.toUpperCase() : null;

  return (
    <div className={cn(
      'flex items-center justify-between p-4 border rounded-lg',
      method.isDefault && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10'
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center',
          'bg-zinc-100 dark:bg-zinc-800'
        )}>
          <TypeIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">{method.name}</p>
          {(method.last4 || currency) && (
            <p className="text-sm text-muted-foreground">
              {method.last4 ? `****${method.last4}` : ''}
              {method.last4 && currency ? ' · ' : ''}
              {currency ? `${currency} payouts` : ''}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {method.isDefault ? (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            {currency ? `Default for ${currency}` : 'Default'}
          </Badge>
        ) : (
          <Button variant="ghost" size="sm" onClick={onSetDefault}>
            Set as default
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Where Stripe will send a payout in `currency`: the account marked default for
 * that currency. A method that reports no currency (the development mock) is
 * accepted as the default for any.
 */
function payoutDestination(methods: PayoutMethod[], currency: string): PayoutMethod | null {
  return (
    methods.find((m) => m.isDefault && m.currency?.toUpperCase() === currency) ??
    methods.find((m) => m.isDefault && !m.currency) ??
    null
  );
}

function WithdrawDialog({
  availableBalance,
  balanceUnavailable,
  currency,
  payoutMethods,
}: {
  /** In major units, or null when Stripe could not be asked. */
  availableBalance: number | null;
  balanceUnavailable: boolean;
  currency: string;
  payoutMethods: PayoutMethod[];
}) {
  const [amount, setAmount] = useState('');
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Stripe pays to the account that is default for the currency; there is no
  // per-payout choice to make. The destination used to be a dropdown with no
  // onValueChange, so picking another account changed nothing and the money
  // still went to the default. It is stated instead, and changed from the
  // Payout Methods tab, which does call Stripe.
  const destination = payoutDestination(payoutMethods, currency);

  const canWithdraw =
    !balanceUnavailable &&
    availableBalance !== null &&
    availableBalance > 0 &&
    destination !== null;

  const blockedReason = balanceUnavailable || availableBalance === null
    ? 'We could not check your Stripe balance just now'
    : availableBalance <= 0
      ? `You have no ${currency} available to withdraw`
      : destination === null
        ? `Add a bank account for ${currency} payouts first`
        : undefined;

  // "Confirm Withdrawal" had no onClick. The dialog opened, took an amount,
  // validated it, and did nothing at all — the same defect as the missing
  // "Connect payouts" control it sits beside, on the same screen.
  const requested = Number.parseFloat(amount);
  const amountIsUsable =
    availableBalance !== null &&
    Number.isFinite(requested) &&
    requested > 0 &&
    requested <= availableBalance;

  const withdraw = useMutation({
    // In major units: the server converts to Stripe's minor units itself, so
    // nothing here multiplies by a hundred. The currency is sent because the
    // route no longer assumes AUD.
    mutationFn: () => connectApi.requestPayout({ amount: requested, currency: currency.toLowerCase() }),
    onSuccess: () => {
      // Stripe pays out on its own schedule, so this does not claim the money
      // has landed — only that it is on its way.
      toast.success('Your withdrawal is on its way to your bank');
      setAmount('');
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['connect', 'earnings'] });
    },
    onError: (error) => {
      toast.error(readErrorMessage(error, 'Could not start that withdrawal'));
    },
  });

  const step = minorUnitScale(currency) === 1 ? '1' : '0.01';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!canWithdraw} title={blockedReason}>
          <Wallet className="h-4 w-4 mr-2" />
          Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>
            Transfer your {currency} earnings to your bank account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-2xl font-bold text-emerald-600">
              {availableBalance === null ? 'Unavailable' : formatMoney(availableBalance, currency)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">Amount to withdraw ({currency})</Label>
            <Input
              id="withdraw-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step={step}
              placeholder={step === '1' ? '0' : '0.00'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto"
              disabled={availableBalance === null}
              onClick={() => availableBalance !== null && setAmount(availableBalance.toString())}
            >
              Withdraw all
            </Button>
          </div>

          <div className="space-y-1">
            <Label>Destination</Label>
            {destination ? (
              <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                {destination.type === 'bank' ? (
                  <Building2 className="h-4 w-4" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                <span>
                  Paid to {destination.name}
                  {destination.last4 && !destination.name.includes(destination.last4)
                    ? ` ****${destination.last4}`
                    : ''}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You have no bank account set as the default for {currency} payouts.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Stripe pays into your default account for {currency}. You can change it on the Payout Methods tab.
            </p>
          </div>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex gap-2">
              <Clock className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  When it arrives
                </p>
                <p className="text-yellow-700 dark:text-yellow-300">
                  Stripe pays your bank on the schedule it sets for your account, so ATHENA cannot give a date.
                  ATHENA takes no fee when you withdraw and sets no minimum.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose className={buttonVariants({ variant: 'outline' })}>Cancel</DialogClose>
          <Button
            disabled={!canWithdraw || !amountIsUsable || withdraw.isPending}
            onClick={() => withdraw.mutate()}
          >
            {withdraw.isPending ? 'Sending…' : 'Confirm Withdrawal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function EarningsDashboard({ className }: { className?: string }) {
  const queryClient = useQueryClient();

  const earningsQuery = useQuery({
    queryKey: ['connect', 'earnings'],
    queryFn: async () => {
      const { data } = await connectApi.getEarnings();
      return data.data as EarningsResponse;
    },
  });

  const payoutMethodsQuery = useQuery({
    queryKey: ['connect', 'payout-methods'],
    queryFn: async () => {
      const { data } = await connectApi.getPayoutMethods();
      return data.data as PayoutMethod[];
    },
    // A user who has not onboarded to Connect yet gets a 409 rather than an
    // empty list, which is expected rather than an error worth retrying.
    retry: false,
  });

  // Whether Stripe will actually pay this woman. Everything below — the
  // Connect payouts button, the Add Method button, the schedule copy — reads
  // from this rather than guessing, because the difference between "no account
  // yet", "half onboarded" and "paid out on Thursdays" is the whole story.
  const accountQuery = useQuery({
    queryKey: ['connect', 'account'],
    queryFn: async () => {
      const { data } = await connectApi.getAccount();
      return data.data as ConnectAccountStatus;
    },
  });

  const setDefault = useMutation({
    mutationFn: (methodId: string) => connectApi.setDefaultPayoutMethod(methodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'payout-methods'] });
      toast.success('Default payout method updated');
    },
    onError: (error: unknown) => {
      toast.error(readErrorMessage(error, 'Could not update the default payout method'));
    },
  });

  // Connecting payouts. This is the control the product has been pointing
  // mentors at since mentoring shipped: "Paid sessions need payouts connected
  // from the mentor dashboard" on become-mentor, and a hard-disabled button
  // here. Because nothing ever called POST /mentors/enable, the only writer of
  // MentorProfile.stripeAccountId, that column was null for every mentor on
  // the platform — and mentor.service.ts refuses to take a payment without it,
  // so not one paid booking could complete for anybody.
  const startPayouts = useMutation({
    mutationFn: async () => {
      try {
        // The mentor door first: it mirrors the connected account onto the
        // mentor profile, which is what the booking gate reads.
        await mentorApi.enable();
      } catch (error) {
        // A member who earns here without a mentor profile (404) still needs an
        // account; she gets the shared Connect one instead.
        if (errorStatus(error) !== 404) throw error;
        await connectApi.createAccount();
      }

      const { data } = await mentorApi.onboard();
      const url = data?.url as string | undefined;
      if (!url) throw new Error('Stripe did not return an onboarding link');
      return url;
    },
    onSuccess: (url) => {
      // Stripe hosts the identity and bank-account steps; it returns to
      // /dashboard/earnings when she is done.
      window.location.href = url;
    },
    onError: (error: unknown) => {
      toast.error(readErrorMessage(error, 'Could not start payout setup'));
    },
  });

  const openStripeDashboard = useMutation({
    mutationFn: async () => {
      const { data } = await mentorApi.getStripeLoginLink();
      const url = data?.url as string | undefined;
      if (!url) throw new Error('Stripe did not return a dashboard link');
      return url;
    },
    onSuccess: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    onError: (error: unknown) => {
      toast.error(readErrorMessage(error, 'Could not open your Stripe dashboard'));
    },
  });

  // Stripe sends her back here with ?payouts=complete when onboarding finishes
  // and ?payouts=refresh when the link expired mid-flow. The status she sees
  // has to be re-read from Stripe at that moment, not served from the cache
  // she left with. Read from the URL rather than useSearchParams so this
  // component does not drag a Suspense boundary into the page that mounts it.
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get('payouts');
    if (!outcome) return;

    queryClient.invalidateQueries({ queryKey: ['connect', 'account'] });
    queryClient.invalidateQueries({ queryKey: ['connect', 'payout-methods'] });

    if (outcome === 'complete') {
      toast.success('Thanks — we are checking your payout details with Stripe');
    } else if (outcome === 'refresh') {
      toast('That payout setup link expired. Start it again when you are ready.');
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('payouts');
    window.history.replaceState({}, '', url.toString());
  }, [queryClient]);

  const earnings = earningsQuery.data;
  const payoutMethods = payoutMethodsQuery.data ?? [];
  // A 409 means she has no connected account yet, which the empty state below
  // already explains. Anything else is a failed read, and an empty list would
  // tell her she has no bank account when we simply do not know.
  const payoutMethodsFailed =
    payoutMethodsQuery.isError && errorStatus(payoutMethodsQuery.error) !== 409;
  const account = accountQuery.data;
  const payoutsEnabled = account?.payoutsEnabled ?? false;
  const onboardingStarted = account?.isOnboarded ?? false;
  const outstandingRequirements = account?.requirements ?? [];
  const connecting = startPayouts.isPending;

  // One control, three states: she has not started, she started and Stripe
  // still wants something, or she is being paid.
  const payoutsControl = payoutsEnabled ? (
    <Button
      variant="outline"
      onClick={() => openStripeDashboard.mutate()}
      disabled={openStripeDashboard.isPending}
    >
      {openStripeDashboard.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <ExternalLink className="mr-2 h-4 w-4" />
      )}
      Manage payouts
    </Button>
  ) : (
    <Button onClick={() => startPayouts.mutate()} disabled={connecting}>
      {connecting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Building2 className="mr-2 h-4 w-4" />
      )}
      {onboardingStarted ? 'Finish payout setup' : 'Connect payouts'}
    </Button>
  );

  if (earningsQuery.isLoading) {
    return (
      <div className={cn('container mx-auto py-16 text-center text-muted-foreground', className)}>
        Loading your earnings…
      </div>
    );
  }

  if (earningsQuery.isError || !earnings) {
    return (
      <div className={cn('container mx-auto py-16 text-center', className)}>
        <p className="font-medium">We could not load your earnings.</p>
        <Button variant="outline" className="mt-4" onClick={() => earningsQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const currency = earnings.currency.toUpperCase();
  const money = (minor: number, code: string = currency) => formatMoney(fromMinorUnits(minor, code), code);

  const totalEarnings = money(earnings.totalEarnings);
  const pendingBalance = money(earnings.pendingPayouts);
  // Null, not zero, when Stripe could not be asked: "we could not check" and
  // "you have nothing" are different statements, and the old fallback to zero
  // made the second during every Stripe outage.
  const balanceUnavailable = earnings.balanceUnavailable || earnings.availableBalance === null;
  const availableBalance =
    balanceUnavailable || earnings.availableBalance === null
      ? null
      : fromMinorUnits(earnings.availableBalance, currency);

  const primaryTotals = earnings.byCurrency.find((c) => c.currency.toUpperCase() === currency);
  // Counted by the server over every captured row. It used to be the number of
  // completed rows among the twenty most recent, so it stopped at twenty for
  // exactly the people who had done the most work.
  const completedCount = primaryTotals?.completedCount ?? 0;

  const otherCurrencies = earnings.byCurrency.filter(
    (c) => c.currency.toUpperCase() !== currency && (c.totalEarnings > 0 || c.pendingPayouts > 0)
  );

  const monthlyInCurrency = new Map(
    earnings.monthly
      .filter((m) => m.currency.toUpperCase() === currency)
      .map((m) => [m.month, fromMinorUnits(m.earnings, currency)])
  );
  const series = lastTwelveMonths(new Date()).map((month) => ({
    month,
    earnings: monthlyInCurrency.get(month) ?? 0,
  }));

  return (
    <div className={cn('container mx-auto py-8 space-y-8', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Earnings</h1>
          <p className="text-muted-foreground">Track your income and manage payouts</p>
        </div>
        <div className="flex items-center gap-3">
          <WithdrawDialog
            availableBalance={availableBalance}
            balanceUnavailable={balanceUnavailable}
            currency={currency}
            payoutMethods={payoutMethods}
          />
        </div>
      </div>

      {/* Payouts status. Until this existed a mentor could set an hourly rate,
          be listed as bookable, and never learn that every booking she was
          offered would fail at the payment step. */}
      {accountQuery.isError ? (
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="font-medium">We could not check your payout status with Stripe just now.</p>
            </div>
            <Button variant="outline" onClick={() => accountQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !accountQuery.isLoading && (
        <Card
          className={cn(
            'border-l-4',
            payoutsEnabled ? 'border-l-emerald-500' : 'border-l-amber-500'
          )}
        >
          <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {payoutsEnabled ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              )}
              <div className="space-y-1">
                <p className="font-medium">
                  {payoutsEnabled
                    ? 'Your payouts are connected'
                    : onboardingStarted
                      ? 'Stripe still needs a few details'
                      : 'Connect payouts to take paid sessions'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {payoutsEnabled
                    ? 'Session payments are held until the session is done, then paid to your account.'
                    : 'Mentees cannot pay for a session with you until this is finished. It takes a few minutes with Stripe, and you will need your bank details and photo ID.'}
                </p>
                {!payoutsEnabled && outstandingRequirements.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Outstanding: {outstandingRequirements.slice(0, 4).join(', ')}
                    {outstandingRequirements.length > 4
                      ? ` and ${outstandingRequirements.length - 4} more`
                      : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0">{payoutsControl}</div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          title="Total Earnings"
          value={totalEarnings}
          note="Released to you, after ATHENA's fee"
          icon={Wallet}
        />
        <StatCard
          title="Available Balance"
          value={availableBalance === null ? 'Unavailable' : formatMoney(availableBalance, currency)}
          note={
            availableBalance === null
              ? 'We could not check your Stripe balance just now'
              : 'Ready to withdraw from Stripe'
          }
          icon={TrendingUp}
        />
        <StatCard
          title="Pending"
          value={pendingBalance}
          note="Held, not yet released to you"
          icon={Clock}
        />
        <StatCard
          title="Completed payments"
          value={completedCount.toLocaleString(getPreferredLocale())}
          icon={CheckCircle2}
        />
      </div>

      {otherCurrencies.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Also earned:{' '}
          {otherCurrencies
            .map((c) => {
              const code = c.currency.toUpperCase();
              const pending = c.pendingPayouts > 0 ? `, with ${money(c.pendingPayouts, code)} pending` : '';
              return `${money(c.totalEarnings, code)}${pending}`;
            })
            .join('; ')}
          . The figures above are in {currency} only.
        </p>
      )}

      {/* Chart */}
      <EarningsChart series={series} currency={currency} />

      {/* Tabs for transactions and payouts */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Payments</TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
          <TabsTrigger value="payouts">Payout Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-6">
          <TransactionsPanel />
        </TabsContent>

        <TabsContent value="statement" className="mt-6">
          <StatementsPanel />
        </TabsContent>

        <TabsContent value="payouts" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payout Methods</CardTitle>
                  <CardDescription>Manage how you receive your earnings</CardDescription>
                </div>
                {payoutsControl}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {payoutMethodsFailed ? (
                <div className="py-10 text-center text-sm">
                  <p className="font-medium">We could not load your payout methods.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => payoutMethodsQuery.refetch()}
                  >
                    Try again
                  </Button>
                </div>
              ) : payoutMethods.length > 0 ? (
                payoutMethods.map((method) => (
                  <PayoutMethodCard
                    key={method.id}
                    method={method}
                    onSetDefault={() => setDefault.mutate(method.id)}
                  />
                ))
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {payoutsEnabled
                    ? 'No payout methods are connected yet. Add a bank account in your Stripe dashboard and it will appear here.'
                    : 'Connect payouts first, and the bank account you give Stripe will appear here.'}
                </div>
              )}

              <Separator className="my-6" />

              <div className="space-y-4">
                <h3 className="font-medium">Payout Schedule</h3>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {payoutsEnabled
                      ? 'Stripe holds each session payment until the session is marked complete, then pays it out on your account’s schedule. You can change that schedule from your Stripe dashboard.'
                      : 'Your payout schedule is set with Stripe once payouts are connected.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EarningsDashboard;

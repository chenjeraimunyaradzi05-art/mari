'use client';

/**
 * Earnings Dashboard
 * Phase 4: Web Client - Persona Studios
 * Step 66: Recharts components for mentor/creator income
 * 
 * Features:
 * - Revenue overview cards
 * - Income charts (line, bar, pie)
 * - Payout history
 * - Tax documents
 * - Withdrawal options
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { connectApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  TrendingUp,
  Download,
  CreditCard,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle,
  Users,
  Video,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

type IncomeSource = 'sessions' | 'courses' | 'tips' | 'referrals';

interface Transaction {
  id: string;
  type: 'earning' | 'payout' | 'refund';
  source: IncomeSource;
  description: string;
  amount: number;
  status: 'completed' | 'pending' | 'processing' | 'failed';
  date: Date;
  metadata?: {
    clientName?: string;
    sessionDuration?: number;
    courseName?: string;
  };
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

interface EarningsData {
  period: string;
  sessions: number;
  courses: number;
  tips: number;
  referrals: number;
}

// ============================================
// CONFIG
// ============================================

const SOURCE_CONFIG: Record<IncomeSource, { label: string; icon: React.ElementType; color: string }> = {
  sessions: { label: 'Sessions', icon: Video, color: 'emerald' },
  courses: { label: 'Courses', icon: BookOpen, color: 'blue' },
  tips: { label: 'Tips', icon: Sparkles, color: 'yellow' },
  referrals: { label: 'Referrals', icon: Users, color: 'purple' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed: { label: 'Completed', color: 'emerald' },
  pending: { label: 'Pending', color: 'yellow' },
  processing: { label: 'Processing', color: 'blue' },
  failed: { label: 'Failed', color: 'red' },
};

// ============================================
// COMPONENTS
// ============================================

function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <div className={cn(
                'flex items-center text-xs',
                trend === 'up' ? 'text-emerald-600' : 'text-red-600'
              )}>
                {trend === 'up' ? (
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 mr-1" />
                )}
                {change > 0 ? '+' : ''}{change}% {changeLabel}
              </div>
            )}
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

function EarningsChart({ data }: { data: EarningsData[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Earnings Overview</CardTitle>
          <CardDescription>Income breakdown by source</CardDescription>
        </CardHeader>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Earnings analytics are not connected yet.
        </CardContent>
      </Card>
    );
  }

  // Calculate totals for chart legend
  const totals = data.reduce(
    (acc, d) => ({
      sessions: acc.sessions + d.sessions,
      courses: acc.courses + d.courses,
      tips: acc.tips + d.tips,
      referrals: acc.referrals + d.referrals,
    }),
    { sessions: 0, courses: 0, tips: 0, referrals: 0 }
  );

  const grandTotal = totals.sessions + totals.courses + totals.tips + totals.referrals;

  // Calculate max for scaling
  const maxValue = Math.max(...data.map(d => d.sessions + d.courses + d.tips + d.referrals), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Earnings Overview</CardTitle>
            <CardDescription>Income breakdown by source</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <div className={cn(
                  'w-3 h-3 rounded-full',
                  key === 'sessions' && 'bg-emerald-500',
                  key === 'courses' && 'bg-blue-500',
                  key === 'tips' && 'bg-yellow-500',
                  key === 'referrals' && 'bg-purple-500'
                )} />
                <span className="text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Simple bar chart representation */}
        <div className="space-y-4">
          <div className="flex items-end justify-between h-48 gap-2">
            {data.map((d, i) => {
              const total = d.sessions + d.courses + d.tips + d.referrals;
              const height = (total / maxValue) * 100;
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse"
                    style={{ height: `${height}%` }}
                  >
                    <div 
                      className="bg-emerald-500 w-full"
                      style={{ height: `${total ? (d.sessions / total) * 100 : 0}%` }}
                    />
                    <div 
                      className="bg-blue-500 w-full"
                      style={{ height: `${total ? (d.courses / total) * 100 : 0}%` }}
                    />
                    <div 
                      className="bg-yellow-500 w-full"
                      style={{ height: `${total ? (d.tips / total) * 100 : 0}%` }}
                    />
                    <div 
                      className="bg-purple-500 w-full"
                      style={{ height: `${total ? (d.referrals / total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{d.period}</span>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Breakdown */}
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(totals).map(([key, value]) => {
              const config = SOURCE_CONFIG[key as IncomeSource];
              const percentage = grandTotal ? ((value / grandTotal) * 100).toFixed(1) : '0.0';
              
              return (
                <div key={key} className="text-center">
                  <p className="text-2xl font-bold">${value.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">
                    {config.label} ({percentage}%)
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your latest earnings and payouts</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={transactions.length === 0}
            title="Transaction export is not connected yet"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No live earnings or payout transactions are connected yet.
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => {
              const sourceConfig = SOURCE_CONFIG[tx.source];
              const statusConfig = STATUS_CONFIG[tx.status];
              const SourceIcon = sourceConfig.icon;

              return (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground">
                    {tx.date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      {tx.metadata?.clientName && (
                        <p className="text-sm text-muted-foreground">
                          {tx.metadata.clientName}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <SourceIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{sourceConfig.label}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        statusConfig.color === 'emerald' && 'border-emerald-500 text-emerald-600',
                        statusConfig.color === 'yellow' && 'border-yellow-500 text-yellow-600',
                        statusConfig.color === 'blue' && 'border-blue-500 text-blue-600',
                        statusConfig.color === 'red' && 'border-red-500 text-red-600'
                      )}
                    >
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn(
                    'text-right font-medium',
                    tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'
                  )}>
                    {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
          {method.last4 && (
            <p className="text-sm text-muted-foreground">****{method.last4}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {method.isDefault ? (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            Default
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

function WithdrawDialog({
  availableBalance,
  payoutMethods,
}: {
  availableBalance: number;
  payoutMethods: PayoutMethod[];
}) {
  const [amount, setAmount] = useState('');
  const canWithdraw = availableBalance > 0 && payoutMethods.length > 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!canWithdraw}>
          <DollarSign className="h-4 w-4 mr-2" />
          Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
          <DialogDescription>
            Transfer your earnings to your bank account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-2xl font-bold text-emerald-600">
              ${availableBalance.toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Amount to withdraw</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto"
              onClick={() => setAmount(availableBalance.toString())}
            >
              Withdraw all
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Destination</Label>
            <Select value={payoutMethods.find((method) => method.isDefault)?.id ?? payoutMethods[0]?.id ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder="No payout method configured" />
              </SelectTrigger>
              <SelectContent>
                {payoutMethods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    <div className="flex items-center gap-2">
                      {method.type === 'bank' ? (
                        <Building2 className="h-4 w-4" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      {method.name}
                      {method.last4 ? ` ****${method.last4}` : ''}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex gap-2">
              <Clock className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Processing Time
                </p>
                <p className="text-yellow-700 dark:text-yellow-300">
                  Transfers typically arrive within 2-3 business days.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose className={buttonVariants({ variant: 'outline' })}>Cancel</DialogClose>
          <Button disabled={!canWithdraw || !amount || parseFloat(amount) <= 0}>
            Confirm Withdrawal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaxDocuments() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tax Documents</CardTitle>
        <CardDescription>Download your tax forms for filing</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="py-10 text-center text-sm text-muted-foreground">
          Tax document generation is not connected yet.
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

// Stripe reports money in the currency's smallest unit.
const fromMinorUnits = (cents: number) => Math.round(cents) / 100;

// Escrow payment statuses mapped onto the four the table renders.
const ESCROW_STATUS: Record<string, Transaction['status']> = {
  CAPTURED: 'completed',
  AUTHORIZED: 'processing',
  PENDING: 'pending',
  CANCELLED: 'failed',
  FAILED: 'failed',
};

interface EarningsResponse {
  totalEarnings: number;
  pendingPayouts: number;
  availableBalance: number;
  recentTransactions: {
    id: string;
    amount: number;
    status: string;
    description: string | null;
    createdAt: string;
    capturedAt: string | null;
  }[];
}

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

  const setDefault = useMutation({
    mutationFn: (methodId: string) => connectApi.setDefaultPayoutMethod(methodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'payout-methods'] });
      toast.success('Default payout method updated');
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not update the default payout method';
      toast.error(message);
    },
  });

  const earnings = earningsQuery.data;
  const payoutMethods = payoutMethodsQuery.data ?? [];

  const totalEarnings = fromMinorUnits(earnings?.totalEarnings ?? 0);
  const pendingBalance = fromMinorUnits(earnings?.pendingPayouts ?? 0);
  const availableBalance = fromMinorUnits(earnings?.availableBalance ?? 0);

  const transactions: Transaction[] = (earnings?.recentTransactions ?? []).map((t) => ({
    id: t.id,
    // Escrow payments are all session work today; the endpoint does not yet
    // distinguish courses, tips or referrals.
    type: 'earning',
    source: 'sessions',
    description: t.description || 'Session payment',
    amount: fromMinorUnits(t.amount),
    status: ESCROW_STATUS[t.status] ?? 'pending',
    date: new Date(t.capturedAt ?? t.createdAt),
  }));

  const totalSessions = transactions.filter((t) => t.status === 'completed').length;

  // The chart wants a series over time; the endpoint returns recent
  // transactions rather than buckets, so group the ones we have by month.
  const earningsData: EarningsData[] = Object.values(
    transactions
      .filter((t) => t.status === 'completed')
      .reduce<Record<string, EarningsData>>((acc, t) => {
        const period = t.date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        acc[period] ??= { period, sessions: 0, courses: 0, tips: 0, referrals: 0 };
        acc[period].sessions += t.amount;
        return acc;
      }, {})
  );

  if (earningsQuery.isLoading) {
    return (
      <div className={cn('container mx-auto py-16 text-center text-muted-foreground', className)}>
        Loading your earnings…
      </div>
    );
  }

  if (earningsQuery.isError) {
    return (
      <div className={cn('container mx-auto py-16 text-center', className)}>
        <p className="font-medium">We could not load your earnings.</p>
        <Button variant="outline" className="mt-4" onClick={() => earningsQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('container mx-auto py-8 space-y-8', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Earnings</h1>
          <p className="text-muted-foreground">Track your income and manage payouts</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value="30d" disabled>
            <SelectTrigger className="w-[140px]" title="Earnings analytics are not connected yet">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <WithdrawDialog availableBalance={availableBalance} payoutMethods={payoutMethods} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          title="Total Earnings"
          value={`$${totalEarnings.toLocaleString()}`}
          icon={DollarSign}
        />
        <StatCard
          title="Available Balance"
          value={`$${availableBalance.toLocaleString()}`}
          icon={TrendingUp}
        />
        <StatCard
          title="Pending"
          value={`$${pendingBalance.toLocaleString()}`}
          icon={Clock}
        />
        <StatCard
          title="Total Sessions"
          value={totalSessions.toString()}
          icon={Video}
        />
      </div>

      {/* Charts */}
      <EarningsChart data={earningsData} />

      {/* Tabs for transactions and payouts */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payouts">Payout Methods</TabsTrigger>
          <TabsTrigger value="tax">Tax Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-6">
          <TransactionsTable transactions={transactions} />
        </TabsContent>

        <TabsContent value="payouts" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payout Methods</CardTitle>
                  <CardDescription>Manage how you receive your earnings</CardDescription>
                </div>
                <Button variant="outline" disabled title="Payout method onboarding is not connected yet">
                  Add Method
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {payoutMethods.length > 0 ? (
                payoutMethods.map((method) => (
                  <PayoutMethodCard
                    key={method.id}
                    method={method}
                    onSetDefault={() => setDefault.mutate(method.id)}
                  />
                ))
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {payoutMethodsQuery.isError
                    ? 'Connect a payout account to add a payout method.'
                    : 'No payout methods are connected yet.'}
                </div>
              )}

              <Separator className="my-6" />

              <div className="space-y-4">
                <h3 className="font-medium">Payout Schedule</h3>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Payout scheduling will appear once Stripe Connect onboarding and payout methods are connected.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <TaxDocuments />
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tax Information</CardTitle>
                <CardDescription>Your tax profile details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Tax profile not connected</span>
                  </div>
                </div>

                <Separator />

                <div className="text-sm text-muted-foreground">
                  Tax profile details will appear after the payout/tax onboarding flow is connected.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EarningsDashboard;

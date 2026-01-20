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
import { cn } from '@/lib/utils';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  CreditCard,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  Filter,
  ChevronDown,
  Users,
  Video,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ============================================
// TYPES
// ============================================

type TimeRange = '7d' | '30d' | '90d' | '12m' | 'all';
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

interface PayoutMethod {
  id: string;
  type: 'bank' | 'paypal' | 'stripe';
  name: string;
  last4?: string;
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
// MOCK DATA
// ============================================

const MOCK_EARNINGS_DATA: EarningsData[] = [
  { period: 'Jan', sessions: 2400, courses: 1200, tips: 180, referrals: 100 },
  { period: 'Feb', sessions: 2800, courses: 1400, tips: 220, referrals: 150 },
  { period: 'Mar', sessions: 3200, courses: 1800, tips: 280, referrals: 180 },
  { period: 'Apr', sessions: 2900, courses: 2000, tips: 240, referrals: 200 },
  { period: 'May', sessions: 3500, courses: 2200, tips: 320, referrals: 250 },
  { period: 'Jun', sessions: 4100, courses: 2400, tips: 380, referrals: 280 },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'earning',
    source: 'sessions',
    description: 'Mentoring Session',
    amount: 150,
    status: 'completed',
    date: new Date(2026, 0, 18),
    metadata: { clientName: 'Alex Thompson', sessionDuration: 60 },
  },
  {
    id: '2',
    type: 'earning',
    source: 'courses',
    description: 'Course Sale: Leadership Fundamentals',
    amount: 49,
    status: 'completed',
    date: new Date(2026, 0, 17),
    metadata: { courseName: 'Leadership Fundamentals' },
  },
  {
    id: '3',
    type: 'payout',
    source: 'sessions',
    description: 'Weekly Payout',
    amount: -2450,
    status: 'processing',
    date: new Date(2026, 0, 15),
  },
  {
    id: '4',
    type: 'earning',
    source: 'tips',
    description: 'Tip from Sarah Chen',
    amount: 25,
    status: 'completed',
    date: new Date(2026, 0, 14),
    metadata: { clientName: 'Sarah Chen' },
  },
  {
    id: '5',
    type: 'earning',
    source: 'referrals',
    description: 'Referral Bonus',
    amount: 50,
    status: 'completed',
    date: new Date(2026, 0, 12),
  },
  {
    id: '6',
    type: 'refund',
    source: 'sessions',
    description: 'Session Cancellation Refund',
    amount: -75,
    status: 'completed',
    date: new Date(2026, 0, 10),
    metadata: { clientName: 'Mike Johnson' },
  },
];

const MOCK_PAYOUT_METHODS: PayoutMethod[] = [
  { id: '1', type: 'bank', name: 'Chase Checking', last4: '4567', isDefault: true },
  { id: '2', type: 'paypal', name: 'PayPal', isDefault: false },
];

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

function EarningsChart({ data, timeRange }: { data: EarningsData[]; timeRange: TimeRange }) {
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
  const maxValue = Math.max(...data.map(d => d.sessions + d.courses + d.tips + d.referrals));

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
                      style={{ height: `${(d.sessions / total) * 100}%` }}
                    />
                    <div 
                      className="bg-blue-500 w-full"
                      style={{ height: `${(d.courses / total) * 100}%` }}
                    />
                    <div 
                      className="bg-yellow-500 w-full"
                      style={{ height: `${(d.tips / total) * 100}%` }}
                    />
                    <div 
                      className="bg-purple-500 w-full"
                      style={{ height: `${(d.referrals / total) * 100}%` }}
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
              const percentage = ((value / grandTotal) * 100).toFixed(1);
              
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
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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

function WithdrawDialog() {
  const [amount, setAmount] = useState('');
  const availableBalance = 3245.50;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
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
            <Select defaultValue="chase">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chase">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Chase Checking ****4567
                  </div>
                </SelectItem>
                <SelectItem value="paypal">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    PayPal
                  </div>
                </SelectItem>
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
          <Button variant="outline">Cancel</Button>
          <Button disabled={!amount || parseFloat(amount) <= 0}>
            Confirm Withdrawal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaxDocuments() {
  const documents = [
    { id: '1', name: '2025 1099-NEC', year: 2025, status: 'available' },
    { id: '2', name: '2024 1099-NEC', year: 2024, status: 'available' },
    { id: '3', name: '2026 1099-NEC', year: 2026, status: 'pending' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tax Documents</CardTitle>
        <CardDescription>Download your tax forms for filing</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{doc.name}</p>
                  <p className="text-sm text-muted-foreground">Tax Year {doc.year}</p>
                </div>
              </div>
              {doc.status === 'available' ? (
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              ) : (
                <Badge variant="outline">Coming Soon</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function EarningsDashboard({ className }: { className?: string }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [payoutMethods, setPayoutMethods] = useState(MOCK_PAYOUT_METHODS);

  // Calculate summary stats
  const totalEarnings = MOCK_EARNINGS_DATA.reduce(
    (sum, d) => sum + d.sessions + d.courses + d.tips + d.referrals,
    0
  );
  const avgSessionRate = 125;
  const totalSessions = 48;
  const pendingBalance = 845.00;
  const availableBalance = 3245.50;

  const handleSetDefaultPayoutMethod = (methodId: string) => {
    setPayoutMethods(methods =>
      methods.map(m => ({ ...m, isDefault: m.id === methodId }))
    );
  };

  return (
    <div className={cn('container mx-auto py-8 space-y-8', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Earnings</h1>
          <p className="text-muted-foreground">Track your income and manage payouts</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[140px]">
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
          <WithdrawDialog />
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          title="Total Earnings"
          value={`$${totalEarnings.toLocaleString()}`}
          change={12.5}
          changeLabel="vs last period"
          icon={DollarSign}
          trend="up"
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
          change={8}
          changeLabel="vs last period"
          icon={Video}
          trend="up"
        />
      </div>

      {/* Charts */}
      <EarningsChart data={MOCK_EARNINGS_DATA} timeRange={timeRange} />

      {/* Tabs for transactions and payouts */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payouts">Payout Methods</TabsTrigger>
          <TabsTrigger value="tax">Tax Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-6">
          <TransactionsTable transactions={MOCK_TRANSACTIONS} />
        </TabsContent>

        <TabsContent value="payouts" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payout Methods</CardTitle>
                  <CardDescription>Manage how you receive your earnings</CardDescription>
                </div>
                <Button variant="outline">
                  Add Method
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {payoutMethods.map((method) => (
                <PayoutMethodCard
                  key={method.id}
                  method={method}
                  onSetDefault={() => handleSetDefaultPayoutMethod(method.id)}
                />
              ))}

              <Separator className="my-6" />

              <div className="space-y-4">
                <h3 className="font-medium">Payout Schedule</h3>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Weekly Payouts</p>
                      <p className="text-sm text-muted-foreground">
                        Every Monday for the previous week's earnings
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Change
                    </Button>
                  </div>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Minimum Payout</p>
                      <p className="text-sm text-muted-foreground">
                        $50.00 minimum balance required for automatic payouts
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Change
                    </Button>
                  </div>
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
                <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="font-medium">W-9 On File</span>
                  </div>
                  <Button variant="link" size="sm">
                    Update
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Legal Name</span>
                    <span>Sarah Johnson</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Business Type</span>
                    <span>Individual</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax ID</span>
                    <span>***-**-1234</span>
                  </div>
                </div>

                <Separator />

                <div className="text-sm text-muted-foreground">
                  <p>
                    Need help with your taxes?{' '}
                    <a href="#" className="text-emerald-600 hover:underline">
                      Learn about creator tax obligations
                    </a>
                  </p>
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

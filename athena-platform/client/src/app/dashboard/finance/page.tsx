'use client';

import Link from 'next/link';
import { Calculator, Receipt, Package, Banknote, ArrowRight, PiggyBank, Shield, TrendingUp, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';

const tiles = [
  {
    title: 'Savings Goals',
    description: 'Emergency funds, home deposits, and goal tracking.',
    href: '/dashboard/finance/savings',
    icon: PiggyBank,
    highlight: true,
  },
  {
    title: 'Insurance',
    description: 'Income protection, life, and health insurance.',
    href: '/dashboard/finance/insurance',
    icon: Shield,
    highlight: true,
  },
  {
    title: 'Super Tracker',
    description: 'Track and optimize your superannuation accounts.',
    href: '/dashboard/finance/super',
    icon: TrendingUp,
    highlight: true,
  },
  {
    title: 'Financial Health',
    description: 'Your personalized financial wellness score.',
    href: '/dashboard/finance/health',
    icon: HeartPulse,
    highlight: true,
  },
  {
    title: 'Accounting',
    description: 'Chart of accounts, journals, and trial balance.',
    href: '/dashboard/finance/accounting',
    icon: Calculator,
  },
  {
    title: 'Tax & Returns',
    description: 'Tax rates, returns, and filings timeline.',
    href: '/dashboard/finance/tax',
    icon: Receipt,
  },
  {
    title: 'Inventory',
    description: 'Items, locations, transactions, and stock levels.',
    href: '/dashboard/finance/inventory',
    icon: Package,
  },
  {
    title: 'Money Ledger',
    description: 'Payments, payouts, transfers, and adjustments.',
    href: '/dashboard/finance/money',
    icon: Banknote,
  },
];

export default function FinanceOverviewPage() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Finance & Wellness Hub</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Build financial security with savings, insurance, super, and business tools.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tiles.map((tile) => (
          <Link
            key={tile.title}
            href={tile.href}
            className={cn(
              'card group flex items-start gap-4 p-5 hover:border-primary-300 transition',
              tile.highlight && 'border-emerald-200 dark:border-emerald-800'
            )}
          >
            <div className={cn(
              'p-3 rounded-xl',
              tile.highlight ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-primary-50 dark:bg-primary-900/20'
            )}>
              <tile.icon className={cn(
                'w-6 h-6',
                tile.highlight ? 'text-emerald-600' : 'text-primary-600'
              )} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tile.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tile.description}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}

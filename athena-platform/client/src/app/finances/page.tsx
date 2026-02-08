'use client';

import Link from 'next/link';
import { DollarSign, TrendingUp, PiggyBank, ArrowRight } from 'lucide-react';

export default function FinancesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
            <DollarSign className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Financial Wellness
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Track your savings goals, manage budgets, and build financial security with ATHENA&apos;s tools designed for women.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <TrendingUp className="w-10 h-10 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Salary Insights</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Compare your salary with industry benchmarks and identify opportunities for growth.
            </p>
            <Link href="/salary-insights" className="text-emerald-600 dark:text-emerald-400 text-sm font-medium inline-flex items-center hover:underline">
              Explore <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <PiggyBank className="w-10 h-10 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Savings Goals</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Set and track savings goals for emergencies, education, home deposits, and more.
            </p>
            <Link href="/dashboard" className="text-emerald-600 dark:text-emerald-400 text-sm font-medium inline-flex items-center hover:underline">
              Get Started <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <DollarSign className="w-10 h-10 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Tax &amp; Super</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Manage tax obligations and superannuation to maximise your long-term wealth.
            </p>
            <Link href="/dashboard" className="text-emerald-600 dark:text-emerald-400 text-sm font-medium inline-flex items-center hover:underline">
              Learn More <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

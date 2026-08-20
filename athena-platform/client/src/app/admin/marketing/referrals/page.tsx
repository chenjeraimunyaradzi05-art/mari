import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function AdminMarketingReferralsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="bg-white dark:bg-slate-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/marketing" className="text-slate-500 hover:text-slate-700">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Referrals</h1>
              <p className="text-slate-600 dark:text-slate-400">Referral program performance</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Referral metrics and incentive settings will appear here.
          </p>
        </div>
      </main>
    </div>
  );
}

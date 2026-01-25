import Link from 'next/link';
import { ArrowLeft, Megaphone } from 'lucide-react';

export default function AdminMarketingCampaignsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/marketing" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
              <p className="text-gray-600 dark:text-gray-400">Coordinate launches and creative performance.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-3 text-indigo-600">
            <Megaphone className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Pipeline</span>
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Track campaign briefs, approval status, and channel metrics here.
          </p>
        </div>
      </main>
    </div>
  );
}

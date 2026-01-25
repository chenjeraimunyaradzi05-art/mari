import Link from 'next/link';
import { ArrowLeft, Megaphone, ArrowRight } from 'lucide-react';

const marketingLinks = [
  { title: 'Campaigns', description: 'Plan and monitor multi-channel launches.', href: '/admin/marketing/campaigns' },
  { title: 'Funnel', description: 'Track activation, retention, and upgrades.', href: '/admin/marketing/funnel' },
  { title: 'Influencers', description: 'Coordinate ambassador and creator programs.', href: '/admin/marketing/influencers' },
  { title: 'Leads', description: 'Manage enterprise and partner leads.', href: '/admin/marketing/leads' },
  { title: 'Partnerships', description: 'Track strategic collaboration pipeline.', href: '/admin/marketing/partnerships' },
  { title: 'Press', description: 'Manage media outreach and assets.', href: '/admin/marketing/press' },
  { title: 'Referrals', description: 'Monitor referral performance and rewards.', href: '/admin/marketing/referrals' },
  { title: 'Waitlist', description: 'Review waitlist conversion and cohorts.', href: '/admin/marketing/waitlist' },
];

export default function AdminMarketingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing</h1>
              <p className="text-gray-600 dark:text-gray-400">Growth campaigns, demand gen, and brand programs.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-4 md:grid-cols-2">
          {marketingLinks.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
                  <Megaphone className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-indigo-600">
                    Open <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

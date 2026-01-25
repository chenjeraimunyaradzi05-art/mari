import Link from 'next/link';
import { ChevronLeft, Megaphone, ArrowRight } from 'lucide-react';

const sections = [
  { title: 'Campaigns', description: 'Launches, lifecycle, and retention campaigns.', href: '/admin/marketing/campaigns' },
  { title: 'Funnel', description: 'Activation, onboarding, and conversion signals.', href: '/admin/marketing/funnel' },
  { title: 'Influencers', description: 'Creator partnerships and influencer ops.', href: '/admin/marketing/influencers' },
  { title: 'Leads', description: 'Lead pipeline and sources.', href: '/admin/marketing/leads' },
  { title: 'Partnerships', description: 'Strategic partners and co-marketing.', href: '/admin/marketing/partnerships' },
  { title: 'Press', description: 'Media inquiries and press releases.', href: '/admin/marketing/press' },
  { title: 'Referrals', description: 'Referral performance and incentives.', href: '/admin/marketing/referrals' },
  { title: 'Waitlist', description: 'Pre-launch signups and nurture flows.', href: '/admin/marketing/waitlist' },
];

export default function AdminMarketingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing Hub</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage campaigns, growth ops, and outreach</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section) => (
            <Link
              key={section.title}
              href={section.href}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{section.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{section.description}</p>
                  <span className="inline-flex items-center gap-2 text-primary-600 text-sm mt-2">
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

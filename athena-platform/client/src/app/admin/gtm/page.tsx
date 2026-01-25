import Link from 'next/link';
import { ChevronLeft, Target, Megaphone, Users, TrendingUp } from 'lucide-react';

const gtmAreas = [
  { title: 'Marketing Hub', description: 'Campaigns, funnel health, and growth ops.', href: '/admin/marketing', icon: Megaphone },
  { title: 'Leads & Demand', description: 'Monitor lead sources and conversion flow.', href: '/admin/marketing/leads', icon: Users },
  { title: 'Partnerships', description: 'Track partnership pipeline and co-marketing.', href: '/admin/marketing/partnerships', icon: TrendingUp },
];

export default function AdminGtmPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Go-to-Market</h1>
              <p className="text-gray-600 dark:text-gray-400">Launch planning, growth levers, and market ops</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {gtmAreas.map((area) => (
            <Link
              key={area.title}
              href={area.href}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg">
                  <area.icon className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{area.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{area.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Launch checklist</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Keep GTM milestones tracked and accountable.</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>• Confirm value proposition and persona alignment</li>
            <li>• Lock launch channels and content calendar</li>
            <li>• Verify onboarding funnel metrics and activation rate</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

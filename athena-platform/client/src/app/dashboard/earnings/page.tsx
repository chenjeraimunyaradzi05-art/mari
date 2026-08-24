import type { Metadata } from 'next';
import { EarningsDashboard } from '@/components/studios/mentor/EarningsDashboard';

export const metadata: Metadata = {
  title: 'Earnings | ATHENA',
  description: 'Track your income and manage payouts.',
};

// EarningsDashboard reads its own data from the Connect API, so this route is
// only the mount point. It sits under /dashboard, which the middleware already
// gates on an authenticated session.
export default function EarningsPage() {
  return <EarningsDashboard />;
}

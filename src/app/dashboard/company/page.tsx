import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import CompanyDashboard from '@/components/dashboard/CompanyDashboard';

export default async function CompanyDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'COMPANY') {
    redirect('/dashboard');
  }

  return <CompanyDashboard />;
}

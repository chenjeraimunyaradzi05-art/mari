import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import CandidateDashboard from '@/components/dashboard/CandidateDashboard';

export default async function CandidateDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'MEMBER') {
    redirect('/dashboard');
  }

  return <CandidateDashboard />;
}


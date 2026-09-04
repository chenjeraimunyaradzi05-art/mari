'use client';

import { useParams } from 'next/navigation';
import { PublicProfile } from '@/components/profile/PublicProfile';

// Same profile inside the dashboard chrome. The rendering lives in
// PublicProfile so the public and signed-in views cannot drift apart.
export default function DashboardProfilePage() {
  const params = useParams<{ id: string }>();
  return <PublicProfile userId={params.id} backHref="/dashboard/community" />;
}

'use client';

import { useParams } from 'next/navigation';
import { PublicProfile } from '@/components/profile/PublicProfile';

// The public profile route. Every author link on the home feed, the feed page
// and the reels player points here, and until now the route did not exist:
// only /profile (a redirect to the signed-in member's own page) was served, so
// tapping any name on the feed was a 404.
export default function ProfilePage() {
  const params = useParams<{ id: string }>();
  return <PublicProfile userId={params.id} backHref="/feed" />;
}

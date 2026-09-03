'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/hooks';
import { Spinner } from '@/components/ui/loading';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  // /profile is a shortcut to the signed-in member's own profile, which is only
  // served under an id segment.
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login?redirect=%2Fprofile');
      return;
    }

    router.replace(user?.id ? `/dashboard/profile/${user.id}` : '/dashboard');
  }, [isAuthenticated, isLoading, router, user?.id]);

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Spinner />
    </div>
  );
}

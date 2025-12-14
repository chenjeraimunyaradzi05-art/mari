'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FollowButtonProps {
  targetId: string;
  initialIsFollowing?: boolean;
  onToggle?: (newState: boolean) => void;
}

export function FollowButton({ targetId, initialIsFollowing = false, onToggle }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggle = async () => {
    setLoading(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const res = await fetch('/api/social/follow', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });

      if (res.ok) {
        const newState = !isFollowing;
        setIsFollowing(newState);
        if (onToggle) onToggle(newState);
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to toggle follow', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
        isFollowing
          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
          : 'bg-black text-white hover:bg-gray-800'
      }`}
    >
      {loading ? '...' : isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}

'use client';

import useSWR from 'swr';
import { FollowButton } from './FollowButton';

interface UserRecommendation {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profileImage: string | null;
  role: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function WhoToFollow() {
  const { data, error } = useSWR<{ data: UserRecommendation[] }>(
    '/api/social/recommendations',
    fetcher
  );

  if (error || !data?.data?.length) return null;

  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm">
      <h3 className="font-bold text-gray-900 mb-4">Who to follow</h3>
      <div className="space-y-4">
        {data.data.map((user) => (
          <div key={user.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {user.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-500 font-medium">
                    {(user.firstName?.[0] || 'U').toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user.role.toLowerCase().replace('_', ' ')}
                </p>
              </div>
            </div>
            <FollowButton targetId={user.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

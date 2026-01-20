'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loader2, Award } from 'lucide-react';

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category?: string;
  xp?: number;
  earned: boolean;
  earnedAt?: string;
};

type AchievementsResponse = {
  achievements: Achievement[];
  stats: {
    earned: number;
    total: number;
    progress: number;
    totalXpEarned: number;
  };
};

export default function AchievementsPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['engagement', 'achievements'],
    queryFn: async () => {
      const res = await api.get<AchievementsResponse>('/engagement/achievements');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center">
        Failed to load achievements. Please try again later.
      </div>
    );
  }

  const earned = data.stats.earned;
  const total = data.stats.total;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Your Wins</h3>
          </div>
          <div className="text-sm text-gray-500">
            {earned}/{total} unlocked • {Math.round(data.stats.totalXpEarned)} XP
          </div>
        </div>
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-2 bg-blue-600"
            style={{ width: `${Math.min(100, Math.max(0, data.stats.progress))}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {data.achievements.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No achievements yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.achievements.map((a) => (
              <div key={a.id} className="p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{a.icon || '🏆'}</span>
                    <div className="font-medium text-gray-900">{a.name}</div>
                    {a.earned ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        Unlocked
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100">
                        Locked
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-gray-600">{a.description}</div>
                </div>
                <div className="text-sm text-gray-500 whitespace-nowrap">{a.xp ? `+${a.xp} XP` : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

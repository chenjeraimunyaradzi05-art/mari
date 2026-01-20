'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Eye, EyeOff, Pin, PinOff, Star, StarOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface GroupRow {
  id: string;
  name: string;
  description: string;
  privacy: 'PUBLIC' | 'PRIVATE';
  isFeatured: boolean;
  isPinned: boolean;
  isHidden: boolean;
  createdAt: string;
  _count: { members: number; posts: number };
}

interface GroupsResponse {
  groups: GroupRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function AdminGroupsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState<'all' | 'true' | 'false'>('all');

  const params = useMemo(() => {
    const qs = new URLSearchParams({
      page: String(page),
      limit: '20',
      search: search.trim(),
    });
    if (hidden !== 'all') qs.set('hidden', hidden);
    return qs.toString();
  }, [page, search, hidden]);

  const { data, isLoading } = useQuery<GroupsResponse>({
    queryKey: ['admin-groups', page, search, hidden],
    queryFn: async () => {
      const response = await api.get(`/admin/groups?${params}`);
      return response.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<GroupRow> }) => {
      await api.patch(`/admin/groups/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Groups Moderation</h1>
              <p className="text-gray-600 dark:text-gray-400">Feature, pin, or hide community groups</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search groups..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            value={hidden}
            onChange={(e) => {
              setHidden(e.target.value as 'all' | 'true' | 'false');
              setPage(1);
            }}
            className="input w-full md:w-48"
          >
            <option value="all">All</option>
            <option value="false">Visible</option>
            <option value="true">Hidden</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.groups.map((group) => (
              <div
                key={group.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${
                  group.isHidden ? 'opacity-60 border-2 border-red-300' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">{group.name}</span>
                        <span className="text-xs text-gray-500">{group.privacy.toLowerCase()}</span>
                        {group.isHidden && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Hidden
                          </span>
                        )}
                        {group.isPinned && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pinned
                          </span>
                        )}
                        {group.isFeatured && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2">
                        {group.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Members: {group._count.members}</span>
                        <span>Posts: {group._count.posts}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: group.id, data: { isPinned: !group.isPinned } })}
                    >
                      {group.isPinned ? <PinOff className="h-4 w-4 mr-1" /> : <Pin className="h-4 w-4 mr-1" />}
                      {group.isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: group.id, data: { isFeatured: !group.isFeatured } })}
                    >
                      {group.isFeatured ? <StarOff className="h-4 w-4 mr-1" /> : <Star className="h-4 w-4 mr-1" />}
                      {group.isFeatured ? 'Unfeature' : 'Feature'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: group.id, data: { isHidden: !group.isHidden } })}
                    >
                      {group.isHidden ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
                      {group.isHidden ? 'Unhide' : 'Hide'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {data?.groups.length === 0 && (
              <div className="text-center py-12 text-gray-500">No groups found.</div>
            )}
          </div>
        )}

        {data && data.pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

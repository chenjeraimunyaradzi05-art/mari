'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Eye, EyeOff, Pin, PinOff, Star, StarOff, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface EventRow {
  id: string;
  title: string;
  description: string;
  type: string;
  format: string;
  date: string;
  isFeatured: boolean;
  isPinned: boolean;
  isHidden: boolean;
}

interface EventsResponse {
  events: EventRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function AdminEventsPage() {
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

  const { data, isLoading } = useQuery<EventsResponse>({
    queryKey: ['admin-events', page, search, hidden],
    queryFn: async () => {
      const response = await api.get(`/admin/events?${params}`);
      return response.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EventRow> }) => {
      await api.patch(`/admin/events/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Events Moderation</h1>
              <p className="text-gray-600 dark:text-gray-400">Feature, pin, or hide events</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search events..."
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
            {data?.events.map((event) => (
              <div
                key={event.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${
                  event.isHidden ? 'opacity-60 border-2 border-red-300' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">{event.title}</span>
                        <span className="text-xs text-gray-500">{event.type.toLowerCase()}</span>
                        <span className="text-xs text-gray-500">{event.format.toLowerCase()}</span>
                        {event.isHidden && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Hidden
                          </span>
                        )}
                        {event.isPinned && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pinned
                          </span>
                        )}
                        {event.isFeatured && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2">
                        {event.description}
                      </p>
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(event.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: event.id, data: { isPinned: !event.isPinned } })}
                    >
                      {event.isPinned ? <PinOff className="h-4 w-4 mr-1" /> : <Pin className="h-4 w-4 mr-1" />}
                      {event.isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: event.id, data: { isFeatured: !event.isFeatured } })}
                    >
                      {event.isFeatured ? <StarOff className="h-4 w-4 mr-1" /> : <Star className="h-4 w-4 mr-1" />}
                      {event.isFeatured ? 'Unfeature' : 'Feature'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: event.id, data: { isHidden: !event.isHidden } })}
                    >
                      {event.isHidden ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
                      {event.isHidden ? 'Unhide' : 'Hide'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {data?.events.length === 0 && (
              <div className="text-center py-12 text-gray-500">No events found.</div>
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

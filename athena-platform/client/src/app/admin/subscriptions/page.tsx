'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ChevronLeft, 
  ChevronRight, 
  CreditCard,
  Gift,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface Subscription {
  id: string;
  userId: string;
  tier: string;
  status: string;
  stripeSubscriptionId: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface SubscriptionsResponse {
  subscriptions: Subscription[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminSubscriptionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantTier, setGrantTier] = useState('PRO');
  const [grantDuration, setGrantDuration] = useState('30');

  const { data, isLoading } = useQuery<SubscriptionsResponse>({
    queryKey: ['admin-subscriptions', page, tierFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (tierFilter) params.append('tier', tierFilter);
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await api.get(`/admin/subscriptions?${params.toString()}`);
      return response.data;
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ subId, updates }: { subId: string; updates: any }) => {
      await api.patch(`/admin/subscriptions/${subId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
  });

  const grantSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, tier, durationDays }: { userId: string; tier: string; durationDays: number }) => {
      await api.post('/admin/subscriptions/grant', { userId, tier, durationDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      setShowGrantModal(false);
      setGrantEmail('');
    },
  });

  const tiers = ['FREE', 'PRO', 'BUSINESS'];
  const statuses = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED'];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'BUSINESS':
        return 'bg-purple-100 text-purple-800';
      case 'PRO':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'TRIALING':
        return 'bg-green-100 text-green-800';
      case 'PAST_DUE':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELED':
      case 'EXPIRED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-gray-500 hover:text-gray-700">
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription Management</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {data?.pagination.total.toLocaleString()} subscriptions
                </p>
              </div>
            </div>
            <Button onClick={() => setShowGrantModal(true)}>
              <Gift className="h-4 w-4 mr-2" />
              Grant Subscription
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700"
            >
              <option value="">All Tiers</option>
              {tiers.map((tier) => (
                <option key={tier} value={tier}>{tier}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700"
            >
              <option value="">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data?.subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {sub.user.firstName} {sub.user.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{sub.user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={sub.tier}
                        onChange={(e) => updateSubscriptionMutation.mutate({ 
                          subId: sub.id, 
                          updates: { tier: e.target.value } 
                        })}
                        className={`text-sm px-2 py-1 rounded border-0 ${getTierColor(sub.tier)}`}
                      >
                        {tiers.map((tier) => (
                          <option key={tier} value={tier}>{tier}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={sub.status}
                        onChange={(e) => updateSubscriptionMutation.mutate({ 
                          subId: sub.id, 
                          updates: { status: e.target.value } 
                        })}
                        className={`text-sm px-2 py-1 rounded border-0 ${getStatusColor(sub.status)}`}
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{new Date(sub.periodStart).toLocaleDateString()} -</div>
                      <div>{new Date(sub.periodEnd).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newEnd = new Date(sub.periodEnd);
                          newEnd.setDate(newEnd.getDate() + 30);
                          updateSubscriptionMutation.mutate({
                            subId: sub.id,
                            updates: { periodEnd: newEnd.toISOString() }
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        +30 days
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500">
                Page {page} of {data.pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === data.pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Grant Subscription Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Grant Subscription
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User Email
                </label>
                <Input
                  type="email"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tier
                </label>
                <select
                  value={grantTier}
                  onChange={(e) => setGrantTier(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700"
                >
                  <option value="PRO">PRO</option>
                  <option value="BUSINESS">BUSINESS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Duration (days)
                </label>
                <Input
                  type="number"
                  value={grantDuration}
                  onChange={(e) => setGrantDuration(e.target.value)}
                  min="1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowGrantModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  // Would need to look up userId by email first
                  // For now, simplified - in production you'd call an API to find user
                  alert('Feature requires user lookup API. Use user ID directly for now.');
                }}
              >
                Grant
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

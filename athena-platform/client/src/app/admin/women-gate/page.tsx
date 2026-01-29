'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, KeyRound, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface InviteCode {
  id: string;
  code: string;
  isActive: boolean;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

interface InviteCodesResponse {
  inviteCodes: InviteCode[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface VerificationUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  womanSelfAttested: boolean;
  womanVerificationStatus: string;
  womanVerifiedAt: string | null;
  createdAt: string;
  subscription?: {
    tier: string;
    status: string;
  } | null;
}

interface VerificationResponse {
  users: VerificationUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface InviteCodeCreatePayload {
  count: number;
  prefix?: string;
  maxUses?: number;
  expiresAt?: string;
}

export default function AdminWomenGatePage() {
  const queryClient = useQueryClient();
  const [invitePage, setInvitePage] = useState(1);
  const [inviteActiveFilter, setInviteActiveFilter] = useState('');
  const [verificationPage, setVerificationPage] = useState(1);
  const [verificationStatus, setVerificationStatus] = useState('PENDING');

  const [count, setCount] = useState('1');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [prefix, setPrefix] = useState('ATHENA');

  const inviteParams = useMemo(() => {
    const params = new URLSearchParams({
      page: invitePage.toString(),
      limit: '20',
    });
    if (inviteActiveFilter) params.append('active', inviteActiveFilter);
    return params.toString();
  }, [invitePage, inviteActiveFilter]);

  const { data: inviteData, isLoading: inviteLoading } = useQuery<InviteCodesResponse>({
    queryKey: ['admin-invite-codes', invitePage, inviteActiveFilter],
    queryFn: async () => {
      const response = await api.get(`/admin/invite-codes?${inviteParams}`);
      return response.data;
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const payload: InviteCodeCreatePayload = {
        count: Number(count || 1),
        prefix: prefix?.trim() || undefined,
      };
      if (maxUses.trim().length) payload.maxUses = Number(maxUses);
      if (expiresAt.trim().length) payload.expiresAt = new Date(expiresAt).toISOString();
      const response = await api.post('/admin/invite-codes', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Invite codes created');
      queryClient.invalidateQueries({ queryKey: ['admin-invite-codes'] });
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(message || 'Failed to create invite codes');
    },
  });

  const toggleInviteMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/admin/invite-codes/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invite-codes'] });
    },
  });

  const verificationParams = useMemo(() => {
    const params = new URLSearchParams({
      page: verificationPage.toString(),
      limit: '20',
      status: verificationStatus,
    });
    return params.toString();
  }, [verificationPage, verificationStatus]);

  const { data: verificationData, isLoading: verificationLoading } = useQuery<VerificationResponse>({
    queryKey: ['admin-woman-verifications', verificationPage, verificationStatus],
    queryFn: async () => {
      const response = await api.get(`/admin/woman-verifications?${verificationParams}`);
      return response.data;
    },
  });

  const updateVerificationMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'VERIFIED' | 'REJECTED' }) => {
      await api.patch(`/admin/woman-verifications/${userId}`, { status });
    },
    onSuccess: () => {
      toast.success('Verification updated');
      queryClient.invalidateQueries({ queryKey: ['admin-woman-verifications'] });
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(message || 'Failed to update verification');
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Women-only Gate</h1>
              <p className="text-gray-600 dark:text-gray-400">Invite codes and verification approvals</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Invite Codes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Count</label>
              <Input value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Max Uses</label>
              <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Expires At</label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Prefix</label>
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={() => createInviteMutation.mutate()} disabled={createInviteMutation.isPending}>
              {createInviteMutation.isPending ? 'Creating...' : 'Create Codes'}
            </Button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Invite Codes</h2>
            </div>
            <select
              value={inviteActiveFilter}
              onChange={(e) => {
                setInviteActiveFilter(e.target.value);
                setInvitePage(1);
              }}
              className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          {inviteLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uses</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {inviteData?.inviteCodes.map((code) => (
                    <tr key={code.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">{code.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {code.usesCount}/{code.maxUses ?? '∞'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            code.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {code.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleInviteMutation.mutate({ id: code.id, isActive: !code.isActive })}
                        >
                          {code.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Verification Requests</h2>
            </div>
            <select
              value={verificationStatus}
              onChange={(e) => {
                setVerificationStatus(e.target.value);
                setVerificationPage(1);
              }}
              className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700"
            >
              <option value="PENDING">Pending</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>
          </div>

          {verificationLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscription</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {verificationData?.users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        <div className="font-medium">{user.firstName} {user.lastName}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {user.subscription?.tier || 'FREE'} ({user.subscription?.status || 'INACTIVE'})
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {user.womanVerificationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {user.womanVerificationStatus === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => updateVerificationMutation.mutate({ userId: user.id, status: 'VERIFIED' })}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateVerificationMutation.mutate({ userId: user.id, status: 'REJECTED' })}
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">No actions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, KeyRound, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import {
  womanGateApi,
  type WomanGateEvidence,
  type WomanGateQueue,
  type WomanGateStatus,
} from '@/lib/woman-gate';

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

interface InviteCodeCreatePayload {
  count: number;
  prefix?: string;
  maxUses?: number;
  expiresAt?: string;
}

/**
 * What the member actually sent, so the decision is made against something.
 * An empty cell is a real and useful answer: it means she has opened a request
 * and not finished it, and approving on that is exactly what this queue used
 * to make easy.
 */
function SubmissionCell({
  evidence,
  ageVerifiedAt,
}: {
  evidence: WomanGateEvidence | null;
  ageVerifiedAt: string | null;
}) {
  if (!evidence) {
    return <span className="text-xs text-slate-500">Nothing submitted yet</span>;
  }

  if (evidence.provider === 'stripe_identity') {
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
          {evidence.documentCheckPassedAt ? 'Photo ID and selfie: passed' : 'Photo ID and selfie: started, not finished'}
        </div>
        {evidence.documentName && (
          <div className="text-xs text-slate-500">Name on document: {evidence.documentName}</div>
        )}
        {evidence.documentType && (
          <div className="text-xs text-slate-500">Document: {evidence.documentType}</div>
        )}
        {ageVerifiedAt && (
          <div className="text-xs text-slate-500">
            Age confirmed from the document on {new Date(ageVerifiedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-800 dark:text-slate-200">In her own words</div>
      {evidence.statement && (
        <p className="whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{evidence.statement}</p>
      )}
      {evidence.evidenceUrl && (
        <a
          href={evidence.evidenceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs font-medium text-purple-600 hover:text-purple-500"
        >
          Supporting link
        </a>
      )}
    </div>
  );
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

  // The queue reads from the verification router rather than the old admin
  // endpoint, because that is where the evidence is. Approving used to be a
  // decision made from a name, an email and a subscription tier —
  // `womanSelfAttested` is true for every account, since registration rejects
  // false, so the fourth column on this screen said nothing at all.
  const { data: verificationData, isLoading: verificationLoading } = useQuery<WomanGateQueue>({
    queryKey: ['admin-woman-verifications', verificationPage, verificationStatus],
    queryFn: () =>
      womanGateApi.queue({
        status: verificationStatus as WomanGateStatus,
        page: verificationPage,
        limit: 20,
      }),
  });

  const updateVerificationMutation = useMutation({
    mutationFn: ({ userId, status, reason }: { userId: string; status: 'VERIFIED' | 'REJECTED'; reason?: string }) =>
      womanGateApi.review(userId, { status, ...(reason ? { reason } : {}) }),
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
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="bg-white dark:bg-slate-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-500 hover:text-slate-700">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Women-only Gate</h1>
              <p className="text-slate-600 dark:text-slate-400">Invite codes and verification approvals</p>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create Invite Codes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">Count</label>
              <Input value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">Max Uses</label>
              <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">Expires At</label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">Prefix</label>
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={() => createInviteMutation.mutate()} disabled={createInviteMutation.isPending}>
              {createInviteMutation.isPending ? 'Creating...' : 'Create Codes'}
            </Button>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Invite Codes</h2>
            </div>
            <select
              value={inviteActiveFilter}
              onChange={(e) => {
                setInviteActiveFilter(e.target.value);
                setInvitePage(1);
              }}
              className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700"
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
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Uses</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Active</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {inviteData?.inviteCodes.map((code) => (
                    <tr key={code.id}>
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-white font-medium">{code.code}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {code.usesCount}/{code.maxUses ?? '∞'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            code.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
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

        <section className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Verification Requests</h2>
            </div>
            <select
              value={verificationStatus}
              onChange={(e) => {
                setVerificationStatus(e.target.value);
                setVerificationPage(1);
              }}
              className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700"
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
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">What she submitted</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {verificationData?.users.map((user) => {
                    const evidence = user.submission?.evidence ?? null;
                    return (
                      <tr key={user.id}>
                        <td className="px-4 py-3 align-top text-sm text-slate-900 dark:text-white">
                          <div className="font-medium">{user.firstName} {user.lastName}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Joined {new Date(user.createdAt).toLocaleDateString()} ·{' '}
                            {user.subscription?.tier || 'FREE'}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-slate-600 dark:text-slate-300">
                          <SubmissionCell evidence={evidence} ageVerifiedAt={user.ageVerifiedAt} />
                        </td>
                        <td className="px-4 py-3 align-top text-sm">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {user.womanVerificationStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          {user.womanVerificationStatus === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                // The server refuses an approval with nothing behind
                                // it; the button says so rather than letting a
                                // reviewer press it and read an error.
                                disabled={!evidence || updateVerificationMutation.isPending}
                                title={evidence ? undefined : 'Nothing has been submitted on this request yet'}
                                onClick={() => updateVerificationMutation.mutate({ userId: user.id, status: 'VERIFIED' })}
                              >
                                <UserCheck className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updateVerificationMutation.isPending}
                                onClick={() => updateVerificationMutation.mutate({ userId: user.id, status: 'REJECTED' })}
                              >
                                <UserX className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">No actions</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

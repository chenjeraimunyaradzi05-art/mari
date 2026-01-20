'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileText, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

type AuditAction =
  | 'DSAR_EXPORT'
  | 'ACCOUNT_DELETE'
  | 'ADMIN_USER_UPDATE'
  | 'ADMIN_USER_DELETE'
  | 'ADMIN_POST_HIDE'
  | 'ADMIN_POST_UNHIDE'
  | 'ADMIN_POST_DELETE'
  | 'ADMIN_POST_CLEAR_REPORTS'
  | 'ADMIN_COMMENT_DELETE'
  | 'ADMIN_GROUP_CREATE'
  | 'ADMIN_GROUP_UPDATE'
  | 'ADMIN_GROUP_DELETE'
  | 'ADMIN_GROUP_MEMBER_ROLE_UPDATE'
  | 'ADMIN_GROUP_POST_DELETE'
  | 'ADMIN_EVENT_CREATE'
  | 'ADMIN_EVENT_UPDATE'
  | 'ADMIN_EVENT_DELETE'
  | 'ADMIN_JOB_UPDATE'
  | 'ADMIN_SUBSCRIPTION_UPDATE'
  | 'ADMIN_SUBSCRIPTION_GRANT';

interface AuditLogUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuditLog {
  id: string;
  action: AuditAction;
  actorUserId: string | null;
  targetUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown | null;
  createdAt: string;
  actorUser: AuditLogUser | null;
  targetUser: AuditLogUser | null;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function formatUser(user: AuditLogUser | null): string {
  if (!user) return '—';
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name ? `${name} (${user.email})` : user.email;
}

function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}…`;
}

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<'' | AuditAction>('');
  const [actorUserId, setActorUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');

  const paramsString = useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '50',
    });
    if (action) params.append('action', action);
    if (actorUserId.trim()) params.append('actorUserId', actorUserId.trim());
    if (targetUserId.trim()) params.append('targetUserId', targetUserId.trim());
    return params.toString();
  }, [page, action, actorUserId, targetUserId]);

  const { data, isLoading, error } = useQuery<AuditLogsResponse>({
    queryKey: ['admin-audit-logs', page, action, actorUserId, targetUserId],
    queryFn: async () => {
      const response = await api.get(`/admin/audit-logs?${paramsString}`);
      return response.data;
    },
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-red-600">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href="/admin">Back to Admin</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
              <p className="text-gray-600 dark:text-gray-400">Compliance exports and account deletions</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value as '' | AuditAction);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Actions</option>
              <option value="DSAR_EXPORT">DSAR Export</option>
              <option value="ACCOUNT_DELETE">Account Delete</option>
              <option value="ADMIN_USER_UPDATE">Admin: User Update</option>
              <option value="ADMIN_USER_DELETE">Admin: User Delete</option>
              <option value="ADMIN_POST_HIDE">Admin: Post Hide</option>
              <option value="ADMIN_POST_UNHIDE">Admin: Post Unhide</option>
              <option value="ADMIN_POST_DELETE">Admin: Post Delete</option>
              <option value="ADMIN_POST_CLEAR_REPORTS">Admin: Clear Reports</option>
              <option value="ADMIN_COMMENT_DELETE">Admin: Comment Delete</option>
              <option value="ADMIN_GROUP_CREATE">Admin: Group Create</option>
              <option value="ADMIN_GROUP_UPDATE">Admin: Group Update</option>
              <option value="ADMIN_GROUP_DELETE">Admin: Group Delete</option>
              <option value="ADMIN_GROUP_MEMBER_ROLE_UPDATE">Admin: Group Role</option>
              <option value="ADMIN_GROUP_POST_DELETE">Admin: Group Post Delete</option>
              <option value="ADMIN_EVENT_CREATE">Admin: Event Create</option>
              <option value="ADMIN_EVENT_UPDATE">Admin: Event Update</option>
              <option value="ADMIN_EVENT_DELETE">Admin: Event Delete</option>
              <option value="ADMIN_JOB_UPDATE">Admin: Job Update</option>
              <option value="ADMIN_SUBSCRIPTION_UPDATE">Admin: Subscription Update</option>
              <option value="ADMIN_SUBSCRIPTION_GRANT">Admin: Subscription Grant</option>
            </select>
            <div className="flex-1 min-w-[240px]">
              <Input
                placeholder="Actor User ID (optional)"
                value={actorUserId}
                onChange={(e) => {
                  setActorUserId(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex-1 min-w-[240px]">
              <Input
                placeholder="Target User ID (optional)"
                value={targetUserId}
                onChange={(e) => {
                  setTargetUserId(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">When</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data?.logs.map((log) => {
                  const ua = log.userAgent || '';
                  const meta = log.metadata ? truncate(JSON.stringify(log.metadata), 180) : '—';
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-gray-900 dark:text-white">{log.action}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div className="max-w-[280px] break-words">
                          {formatUser(log.actorUser)}
                        </div>
                        {log.actorUserId && !log.actorUser && (
                          <div className="text-xs text-gray-500">{log.actorUserId}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div className="max-w-[280px] break-words">
                          {formatUser(log.targetUser)}
                        </div>
                        {log.targetUserId && !log.targetUser && (
                          <div className="text-xs text-gray-500">{log.targetUserId}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {log.ipAddress || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <span title={ua}>{ua ? truncate(ua, 80) : '—'}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div className="max-w-[360px] break-words" title={log.metadata ? JSON.stringify(log.metadata) : ''}>
                          {meta}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {data?.logs.length === 0 && (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={7}>
                      No audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {data && data.pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

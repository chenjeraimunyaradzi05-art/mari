'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileText, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

/**
 * The actions this viewer can filter on, grouped the way a privacy officer
 * asks the question. The server decides what each one means across old rows:
 * asking for "Account banned" also finds bans recorded before moderation
 * decisions had verbs of their own, and asking for a staff change finds the
 * ones filed as data access before ADMIN_CONFIG_UPDATE and
 * ADMIN_CONTENT_UPDATE existed. The list used to stop at the original twenty
 * admin verbs, so none of the moderation, safety or staff-change rows could be
 * asked for at all.
 */
const ACTION_GROUPS: Array<{ label: string; actions: Array<{ value: string; label: string }> }> = [
  {
    label: 'Moderation decisions',
    actions: [
      { value: 'MODERATION_DISMISS', label: 'Report dismissed' },
      { value: 'MODERATION_WARN', label: 'Warning issued' },
      { value: 'MODERATION_REMOVE', label: 'Content removed' },
      { value: 'MODERATION_SUSPEND', label: 'Account suspended' },
      { value: 'MODERATION_BAN', label: 'Account banned' },
      { value: 'MODERATION_ESCALATE', label: 'Sent to senior review' },
      { value: 'SAFETY_REPORT_DECIDED', label: 'Safety report decided' },
      { value: 'ADMIN_APPEAL_DECISION', label: 'Appeal decided' },
    ],
  },
  {
    label: 'Staff changes',
    actions: [
      { value: 'ADMIN_CONFIG_UPDATE', label: 'Platform configuration changed' },
      { value: 'ADMIN_CONTENT_UPDATE', label: 'Catalogue or content changed' },
      { value: 'ADMIN_USER_UPDATE', label: 'Member account updated' },
      { value: 'ADMIN_USER_DELETE', label: 'Member account deleted' },
      { value: 'ADMIN_VERIFICATION_APPROVE', label: 'Verification approved' },
      { value: 'ADMIN_VERIFICATION_REJECT', label: 'Verification refused' },
      { value: 'ADMIN_POST_HIDE', label: 'Post hidden' },
      { value: 'ADMIN_POST_UNHIDE', label: 'Post unhidden' },
      { value: 'ADMIN_POST_DELETE', label: 'Post deleted' },
      { value: 'ADMIN_POST_CLEAR_REPORTS', label: 'Post reports cleared' },
      { value: 'ADMIN_COMMENT_DELETE', label: 'Comment deleted' },
      { value: 'ADMIN_GROUP_CREATE', label: 'Group created' },
      { value: 'ADMIN_GROUP_UPDATE', label: 'Group updated' },
      { value: 'ADMIN_GROUP_DELETE', label: 'Group deleted' },
      { value: 'ADMIN_GROUP_MEMBER_ROLE_UPDATE', label: 'Group role changed' },
      { value: 'ADMIN_GROUP_POST_DELETE', label: 'Group post deleted' },
      { value: 'ADMIN_EVENT_CREATE', label: 'Event created' },
      { value: 'ADMIN_EVENT_UPDATE', label: 'Event updated' },
      { value: 'ADMIN_EVENT_DELETE', label: 'Event deleted' },
      { value: 'ADMIN_JOB_UPDATE', label: 'Job updated' },
      { value: 'ADMIN_SUBSCRIPTION_UPDATE', label: 'Subscription updated' },
      { value: 'ADMIN_SUBSCRIPTION_GRANT', label: 'Subscription granted' },
    ],
  },
  {
    label: 'Privacy and accounts',
    actions: [
      { value: 'DATA_ACCESS', label: 'Data access' },
      { value: 'DSAR_EXPORT', label: 'Data export' },
      { value: 'ACCOUNT_DELETE', label: 'Account deleted by its owner' },
      { value: 'USER_APPEAL_SUBMIT', label: 'Appeal submitted' },
      { value: 'USER_VERIFICATION_SUBMIT', label: 'Verification requested' },
      { value: 'SIGN_IN_PROVIDER_LINKED', label: 'Sign-in provider linked' },
    ],
  },
];

interface AuditLogUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuditLog {
  id: string;
  action: string;
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

/**
 * The precise verb a staff row carries in its metadata, when it has one: the
 * enum value says "a catalogue changed", this says which and how.
 */
function adminVerbOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  const verb = record.adminAction ?? record.moderationAction;
  return typeof verb === 'string' && verb.trim() ? verb : null;
}

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

function truncate(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}…`;
}

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
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

  const { data, isLoading, error, refetch } = useQuery<AuditLogsResponse>({
    queryKey: ['admin-audit-logs', page, action, actorUserId, targetUserId],
    queryFn: async () => {
      const response = await api.get(`/admin/audit-logs?${paramsString}`);
      return response.data;
    },
  });

  // Only a refusal is "access denied". Every other failure used to show the
  // same screen, so an outage told an administrator she had lost her
  // permissions, and a log that failed to load looked like one she was not
  // allowed to see rather than one that had not arrived.
  if (error) {
    const denied = statusOf(error) === 401 || statusOf(error) === 403;
    return (
      <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-red-600">{denied ? 'Access Denied' : 'The audit log could not be loaded'}</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {denied
              ? 'You do not have permission to access this page.'
              : 'The request did not complete, so nothing here tells you the log is empty. Try again, and tell an engineer if it keeps failing.'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {!denied && (
              <Button variant="outline" onClick={() => void refetch()}>
                Try again
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/admin">Back to Admin</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="bg-white dark:bg-slate-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-slate-500 hover:text-slate-700">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Logs</h1>
              <p className="text-slate-600 dark:text-slate-400">Who did what on the platform: moderation, staff changes, and access to member data</p>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              aria-label="Action"
              className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="">All Actions</option>
              {ACTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.actions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
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

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">When</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">IP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data?.logs.map((log) => {
                  const ua = log.userAgent || '';
                  const meta = log.metadata ? truncate(JSON.stringify(log.metadata), 180) : '—';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-500" />
                          <span className="font-medium text-slate-900 dark:text-white">{log.action}</span>
                        </span>
                        {adminVerbOf(log.metadata) && (
                          <span className="mt-1 block text-xs text-slate-500">{adminVerbOf(log.metadata)}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                        <div className="max-w-[280px] break-words">
                          {formatUser(log.actorUser)}
                        </div>
                        {log.actorUserId && !log.actorUser && (
                          <div className="text-xs text-slate-500">{log.actorUserId}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                        <div className="max-w-[280px] break-words">
                          {formatUser(log.targetUser)}
                        </div>
                        {log.targetUserId && !log.targetUser && (
                          <div className="text-xs text-slate-500">{log.targetUserId}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                        {log.ipAddress || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                        <span title={ua}>{ua ? truncate(ua, 80) : '—'}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                        <div className="max-w-[360px] break-words" title={log.metadata ? JSON.stringify(log.metadata) : ''}>
                          {meta}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {data?.logs.length === 0 && (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-slate-500" colSpan={7}>
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
            <div className="text-sm text-slate-500">
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

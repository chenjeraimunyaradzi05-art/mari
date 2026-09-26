'use client';

/**
 * The data-subject request queue: every access, correction, erasure and
 * restriction request a member has made, open ones first by due date.
 *
 * The 30-day clock (APP 12.4 as the OAIC reads it; one month under GDPR Art
 * 12(3)) was stored on every request and shown nowhere. This screen counted
 * requests off the audit log, so a privacy officer could see how many exports
 * had happened but not which requests were still open, who had them, or which
 * were about to run out of time. An erasure refused under a legal hold, or a
 * correction the self-service path could not apply, sat in a table nobody
 * could open.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { Button } from '@/components/ui/button';

type DsarStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'EXPIRED';
type DsarType = 'EXPORT' | 'DELETION' | 'RECTIFICATION' | 'RESTRICTION' | 'PORTABILITY';

interface DsarRequest {
  id: string;
  type: DsarType;
  status: DsarStatus;
  requestDetails: string | null;
  assignedTo: string | null;
  processingNotes: string | null;
  requestedAt: string;
  dueDate: string;
  completedAt: string | null;
  daysRemaining: number | null;
  overdue: boolean;
  user: { id: string; email: string; firstName: string; lastName: string; region: string } | null;
  assignee: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface DsarQueueResponse {
  requests: DsarRequest[];
  summary: { open: number; overdue: number; dueWithinWeek: number; unassigned: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const TYPE_LABEL: Record<DsarType, string> = {
  EXPORT: 'Access (export)',
  DELETION: 'Erasure',
  RECTIFICATION: 'Correction',
  RESTRICTION: 'Restriction',
  PORTABILITY: 'Portability',
};

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ??
  (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.message;

function dueLabel(request: DsarRequest): string {
  if (request.daysRemaining === null) {
    return request.completedAt ? `Closed ${new Date(request.completedAt).toLocaleDateString('en-AU')}` : '—';
  }
  if (request.overdue) {
    const days = Math.abs(request.daysRemaining);
    return days === 0 ? 'Overdue by less than a day' : `Overdue by ${days} day${days === 1 ? '' : 's'}`;
  }
  if (request.daysRemaining === 0) return 'Due today';
  return `${request.daysRemaining} day${request.daysRemaining === 1 ? '' : 's'} left`;
}

export function DsarQueue() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [status, setStatus] = useState<'open' | 'all' | DsarStatus>('open');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const queue = useQuery<DsarQueueResponse>({
    queryKey: ['admin-dsar-queue', status, page],
    queryFn: async () => (await api.get('/admin/gdpr/dsar-requests', { params: { status, page, limit: 25 } })).data,
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/admin/gdpr/dsar-requests/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dsar-queue'] });
      toast.success('Saved');
    },
    onError: (error) => toast.error(errorMessage(error) || 'That change could not be saved'),
  });

  const addNote = (request: DsarRequest) => {
    const note = window.prompt('Add a note to this request (what you did, who you spoke to):');
    if (note && note.trim()) update.mutate({ id: request.id, body: { note: note.trim() } });
  };

  const complete = (request: DsarRequest) => {
    const note = window.prompt('What was done to complete this request? This is kept on the request.');
    if (!note || !note.trim()) return;
    update.mutate({ id: request.id, body: { status: 'COMPLETED', note: note.trim() } });
  };

  const reject = (request: DsarRequest) => {
    const reason = window.prompt(
      'Why is this request refused? The member is sent this reason (APP 12.9 requires written reasons), so write it for her.'
    );
    if (!reason || !reason.trim()) return;
    update.mutate({ id: request.id, body: { status: 'REJECTED', memberMessage: reason.trim() } });
  };

  const summary = queue.data?.summary;
  const requests = queue.data?.requests ?? [];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Privacy requests</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Access, correction, erasure and restriction requests, with the 30-day response clock. Open requests are listed
            soonest due first.
          </p>
          {summary && (
            <p className="mt-2 text-sm">
              <span className="text-slate-700 dark:text-slate-200">{summary.open} open</span>
              {summary.overdue > 0 && <span className="font-semibold text-red-600"> · {summary.overdue} overdue</span>}
              {summary.dueWithinWeek > 0 && <span className="text-amber-700"> · {summary.dueWithinWeek} due within 7 days</span>}
              {summary.unassigned > 0 && <span className="text-slate-500"> · {summary.unassigned} with nobody on them</span>}
            </p>
          )}
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
          }}
          className="px-3 py-2 border rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          aria-label="Which requests"
        >
          <option value="open">Open</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Refused</option>
          <option value="EXPIRED">Expired</option>
          <option value="all">All</option>
        </select>
      </div>

      {queue.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : queue.isError ? (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" /> The request queue could not be loaded. That is not the same as there being
          none — refresh to try again.
        </p>
      ) : requests.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {status === 'open' ? 'No open requests.' : 'No requests match.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Member</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Request</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Due</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">With</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {requests.map((request) => {
                const open = request.status === 'PENDING' || request.status === 'IN_PROGRESS';
                const mine = request.assignedTo === user?.id;
                return (
                  <tr key={request.id} className="align-top">
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                      {request.user ? (
                        <>
                          <div className="font-medium">
                            {request.user.firstName} {request.user.lastName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {request.user.email} · {request.user.region}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500">Account removed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="font-medium text-slate-900 dark:text-white">{TYPE_LABEL[request.type] ?? request.type}</div>
                      <div className="text-xs">
                        {request.status.replace('_', ' ').toLowerCase()} · asked {new Date(request.requestedAt).toLocaleDateString('en-AU')}
                      </div>
                      {(request.requestDetails || request.processingNotes) && (
                        <button
                          type="button"
                          onClick={() => setExpanded(expanded === request.id ? null : request.id)}
                          className="mt-1 text-xs text-primary-600 hover:underline"
                        >
                          {expanded === request.id ? 'Hide details' : 'Details and notes'}
                        </button>
                      )}
                      {expanded === request.id && (
                        <div className="mt-2 space-y-2 text-xs">
                          {request.requestDetails && (
                            <pre className="whitespace-pre-wrap rounded bg-slate-50 p-2 dark:bg-slate-900">{request.requestDetails}</pre>
                          )}
                          {request.processingNotes && (
                            <pre className="whitespace-pre-wrap rounded bg-slate-50 p-2 dark:bg-slate-900">{request.processingNotes}</pre>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm ${request.overdue ? 'font-semibold text-red-600' : 'text-slate-600 dark:text-slate-300'}`}>
                      {dueLabel(request)}
                      <div className="text-xs font-normal text-slate-500">{new Date(request.dueDate).toLocaleDateString('en-AU')}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {request.assignee ? `${request.assignee.firstName} ${request.assignee.lastName}` : 'Nobody yet'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {open ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          {!mine && (
                            <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: request.id, body: { assignedTo: 'me', ...(request.status === 'PENDING' ? { status: 'IN_PROGRESS' } : {}) } })}>
                              Take it
                            </Button>
                          )}
                          {mine && (
                            <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: request.id, body: { assignedTo: null } })}>
                              Give back
                            </Button>
                          )}
                          <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => addNote(request)}>
                            Note
                          </Button>
                          {request.type !== 'DELETION' && (
                            <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => complete(request)}>
                              Complete
                            </Button>
                          )}
                          <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => reject(request)}>
                            Refuse
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {queue.data && queue.data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {queue.data.pagination.totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= queue.data.pagination.totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * Feedback, worked through: new, seen, done. What people wrote, who they
 * are when they were signed in, the page they came from, and the reply
 * address when there is one.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Bug, Lightbulb, Loader2, MessageSquare, ThumbsUp } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'NEW' | 'SEEN' | 'DONE';
type Category = 'BUG' | 'IDEA' | 'PRAISE' | 'OTHER';
type Item = {
  id: string;
  message: string;
  category: Category;
  status: Status;
  email: string | null;
  page: string | null;
  createdAt: string;
  user: { id: string; firstName?: string; lastName?: string; displayName?: string | null } | null;
};

const STATUSES: Status[] = ['NEW', 'SEEN', 'DONE'];
const ICON: Record<Category, typeof Bug> = { BUG: Bug, IDEA: Lightbulb, PRAISE: ThumbsUp, OTHER: MessageSquare };
const TONE: Record<Status, string> = { NEW: 'bg-amber-100 text-amber-800', SEEN: 'bg-blue-100 text-blue-800', DONE: 'bg-emerald-100 text-emerald-800' };
const who = (i: Item) => (i.user ? i.user.displayName || [i.user.firstName, i.user.lastName].filter(Boolean).join(' ') || 'A member' : i.email || 'A visitor');
const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

export default function AdminFeedbackPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'' | Status>('NEW');

  const feedback = useQuery({
    queryKey: ['admin-feedback', status],
    queryFn: () => api.get('/admin/feedback', { params: status ? { status } : {} }),
    select: (r) => ({ items: (Array.isArray(r.data?.data) ? r.data.data : []) as Item[], counts: (r.data?.counts ?? {}) as Partial<Record<Status, number>> }),
  });
  const move = useMutation({
    mutationFn: ({ id, next }: { id: string; next: Status }) => api.patch(`/admin/feedback/${id}`, { status: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-feedback'] }),
    onError: (e: unknown) => toast.error(errorMessage(e) || 'That did not save'),
  });

  const counts = feedback.data?.counts ?? {};

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
        <MessageSquare className="h-7 w-7 text-primary-600" /> Feedback
      </h1>
      <p className="mt-1 mb-6 text-slate-600 dark:text-slate-400">From the help centre's feedback page. Mark it seen when someone has read it, done when it is dealt with.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['', ...STATUSES] as Array<'' | Status>).map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={cn('rounded-full border px-3 py-1 text-xs font-medium', status === s ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300')}>
            {s ? `${s.toLowerCase()} · ${counts[s] ?? 0}` : 'all'}
          </button>
        ))}
      </div>

      {feedback.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (feedback.data?.items.length ?? 0) === 0 ? (
        <div className="card p-10 text-center text-slate-500">Nothing here.</div>
      ) : (
        <ul className="space-y-3">
          {feedback.data!.items.map((i) => {
            const Icon = ICON[i.category] ?? MessageSquare;
            return (
              <li key={i.id} className="card">
                <div className="flex flex-wrap items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">
                      {i.category.toLowerCase()} · {who(i)}
                      {i.user && i.email ? ` · ${i.email}` : ''} · {formatDistanceToNow(new Date(i.createdAt), { addSuffix: true })}
                      {i.page ? ` · from ${i.page}` : ''}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{i.message}</p>
                    {i.email && (
                      <a href={`mailto:${i.email}`} className="mt-2 inline-block text-xs text-primary-600 hover:underline">
                        Reply by email
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', TONE[i.status])}>{i.status.toLowerCase()}</span>
                    {STATUSES.filter((s) => s !== i.status).map((s) => (
                      <button key={s} type="button" onClick={() => move.mutate({ id: i.id, next: s })} disabled={move.isPending} className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                        {s.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

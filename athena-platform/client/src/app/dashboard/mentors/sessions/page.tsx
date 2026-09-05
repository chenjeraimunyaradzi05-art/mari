'use client';

/**
 * Mentoring sessions, from both sides of the table.
 *
 * "With mentors" lists the sessions the member requested: cancel or move
 * one that has not happened yet. "As a mentor" appears for members with a
 * mentor profile: confirm or decline a request, move it, mark it complete.
 * Every action here has existed on the server for some time; this is the
 * first page that reaches it. Notification links land here with ?session=.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { ArrowLeft, CalendarDays, Check, Clock, Loader2, X } from 'lucide-react';
import { mentorApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { Avatar } from '@/components/ui/avatar';
import { cn, formatCurrency } from '@/lib/utils';

type Role = 'mentee' | 'mentor';
type Status = 'REQUESTED' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED';

type Session = {
  id: string;
  scheduledAt: string | null;
  durationMinutes: number;
  status: Status;
  note: string | null;
  currency?: string;
  sessionAmount?: string | number;
  mentee?: { id: string; displayName: string | null; avatar: string | null };
  mentorProfile?: { id: string; user: { id: string; displayName: string | null; avatar: string | null } };
};

const STATUS: Record<Status, { label: string; className: string }> = {
  REQUESTED: { label: 'Requested', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' },
  COMPLETED: { label: 'Completed', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  CANCELED: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200' },
};

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

function counterpartOf(session: Session, role: Role) {
  const person = role === 'mentee' ? session.mentorProfile?.user : session.mentee;
  return { id: person?.id, name: person?.displayName || (role === 'mentee' ? 'Mentor' : 'Mentee'), avatar: person?.avatar || undefined };
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MentorSessionsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const highlighted = searchParams?.get('session') ?? null;
  const [role, setRole] = useState<Role>('mentee');
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [newTime, setNewTime] = useState('');
  const highlightRef = useRef<HTMLLIElement | null>(null);

  const profile = useQuery({
    queryKey: ['mentor-profile', user?.id],
    queryFn: () => mentorApi.getProfileByUser(user!.id),
    enabled: Boolean(user?.id) && isAuthenticated,
    retry: false,
    select: (response) => response.data as { id: string } | null,
  });
  const isMentor = Boolean(profile.data?.id);

  // The notification says which session; open the side it belongs to.
  useEffect(() => {
    if (isMentor && highlighted) setRole('mentor');
  }, [isMentor, highlighted]);

  const sessions = useQuery({
    queryKey: ['mentor-sessions', role],
    queryFn: () => mentorApi.getSessions(role),
    enabled: isAuthenticated && !authLoading && (role === 'mentee' || isMentor),
    select: (response) => {
      const raw = response.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      return list as Session[];
    },
  });

  useEffect(() => {
    if (highlighted && highlightRef.current) highlightRef.current.scrollIntoView({ block: 'center' });
  }, [highlighted, sessions.data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['mentor-sessions'] });
  };

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'CONFIRMED' | 'CANCELED' | 'COMPLETED' }) => mentorApi.updateSessionStatus(id, status),
    onSuccess: (_res, { status }) => {
      refresh();
      toast.success(status === 'CONFIRMED' ? 'Session confirmed' : status === 'COMPLETED' ? 'Session marked complete' : 'Session cancelled');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not update the session'),
  });

  const reschedule = useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) => mentorApi.reschedule(id, scheduledAt),
    onSuccess: () => {
      refresh();
      setRescheduling(null);
      toast.success('Session moved');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not move the session'),
  });

  const { upcoming, past } = useMemo(() => {
    const list = sessions.data ?? [];
    const now = Date.now();
    const open = (s: Session) => s.status === 'REQUESTED' || s.status === 'CONFIRMED';
    const upcomingList = list
      .filter((s) => open(s) && (!s.scheduledAt || new Date(s.scheduledAt).getTime() >= now))
      .sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());
    const pastList = list.filter((s) => !upcomingList.includes(s));
    return { upcoming: upcomingList, past: pastList };
  }, [sessions.data]);

  const confirmCancel = (session: Session) => {
    if (!window.confirm('Cancel this session? The other person is told.')) return;
    changeStatus.mutate({ id: session.id, status: 'CANCELED' });
  };

  const Row = ({ session }: { session: Session }) => {
    const person = counterpartOf(session, role);
    const status = STATUS[session.status] ?? STATUS.REQUESTED;
    const open = session.status === 'REQUESTED' || session.status === 'CONFIRMED';
    const amount = session.sessionAmount !== undefined ? Number(session.sessionAmount) : null;
    const isHighlighted = highlighted === session.id;

    return (
      <li
        ref={isHighlighted ? highlightRef : undefined}
        className={cn('card space-y-3 p-4', isHighlighted && 'ring-2 ring-primary-500')}
        aria-current={isHighlighted ? 'true' : undefined}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar src={person.avatar} alt={person.name} fallback={person.name.slice(0, 2).toUpperCase()} size="sm" />
            <div>
              {person.id ? (
                <Link href={`/profile/${person.id}`} className="font-semibold text-slate-900 hover:underline dark:text-white">
                  {person.name}
                </Link>
              ) : (
                <span className="font-semibold text-slate-900 dark:text-white">{person.name}</span>
              )}
              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {session.scheduledAt ? format(new Date(session.scheduledAt), 'EEE d MMM yyyy, h:mm a') : 'Time to be agreed'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {session.durationMinutes} min
                </span>
                {amount !== null && amount > 0 && <span>{formatCurrency(amount)}</span>}
              </div>
            </div>
          </div>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', status.className)}>{status.label}</span>
        </div>

        {session.note && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">{session.note}</p>}

        {open && (
          <div className="flex flex-wrap items-center gap-2">
            {role === 'mentor' && session.status === 'REQUESTED' && (
              <>
                <button
                  type="button"
                  onClick={() => changeStatus.mutate({ id: session.id, status: 'CONFIRMED' })}
                  disabled={changeStatus.isPending}
                  className="btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-sm"
                >
                  <Check className="h-4 w-4" /> Confirm
                </button>
                <button type="button" onClick={() => confirmCancel(session)} disabled={changeStatus.isPending} className="btn-outline inline-flex items-center gap-1 px-3 py-1.5 text-sm">
                  <X className="h-4 w-4" /> Decline
                </button>
              </>
            )}
            {role === 'mentor' && session.status === 'CONFIRMED' && (
              <button
                type="button"
                onClick={() => changeStatus.mutate({ id: session.id, status: 'COMPLETED' })}
                disabled={changeStatus.isPending}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                Mark complete
              </button>
            )}
            {(role === 'mentee' || session.status === 'CONFIRMED') && (
              <button type="button" onClick={() => confirmCancel(session)} disabled={changeStatus.isPending} className="text-sm font-medium text-red-600 hover:text-red-700">
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setRescheduling(rescheduling === session.id ? null : session.id);
                setNewTime(toLocalInput(session.scheduledAt));
              }}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300"
            >
              {rescheduling === session.id ? 'Keep the time' : 'Move'}
            </button>
          </div>
        )}

        {rescheduling === session.id && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const when = new Date(newTime);
              if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
                toast.error('Choose a time in the future');
                return;
              }
              reschedule.mutate({ id: session.id, scheduledAt: when.toISOString() });
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="datetime-local" value={newTime} onChange={(e) => setNewTime(e.target.value)} required className="input" aria-label="New time" />
            <button type="submit" disabled={reschedule.isPending} className="btn-primary px-3 py-1.5 text-sm">
              Save new time
            </button>
          </form>
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link href="/dashboard/mentors" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" /> Find a mentor
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">Mentoring sessions</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Requests, confirmed sessions and what has been completed.</p>
      </div>

      {isMentor && (
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Which side">
          {(
            [
              ['mentee', 'With mentors'],
              ['mentor', 'As a mentor'],
            ] as Array<[Role, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={role === value}
              onClick={() => setRole(value)}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium',
                role === value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {sessions.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Upcoming</h2>
            {upcoming.length === 0 ? (
              <div className="card p-6 text-sm text-slate-500 dark:text-slate-400">
                {role === 'mentee' ? (
                  <>
                    Nothing booked.{' '}
                    <Link href="/dashboard/mentors" className="text-primary-600 hover:underline">
                      Find a mentor
                    </Link>{' '}
                    to request a session.
                  </>
                ) : (
                  'No requests waiting. New requests appear here and in your notifications.'
                )}
              </div>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((session) => (
                  <Row key={session.id} session={session} />
                ))}
              </ul>
            )}
          </section>

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Past</h2>
              <ul className="space-y-3">
                {past.map((session) => (
                  <Row key={session.id} session={session} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

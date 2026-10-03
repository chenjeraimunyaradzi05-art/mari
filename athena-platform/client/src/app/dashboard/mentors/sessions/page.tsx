'use client';

/**
 * Mentoring sessions, from both sides of the table.
 *
 * "With mentors" lists the sessions the member requested: cancel or move
 * one that has not happened yet. "As a mentor" appears for members with a
 * mentor profile: confirm or decline a request, move it, mark it complete.
 * Every action here has existed on the server for some time; this is the
 * first page that reaches it. Notification links land here with ?session=.
 *
 * Completing a session is what takes the money held on the mentee's card, and
 * the server lets either person do it once the booked time has passed — not
 * before, and after that the mentee can no longer cancel a confirmed session
 * (a request the mentor never accepted she can always withdraw). The page used to
 * offer the mentor "Mark complete" on a session still weeks away and the
 * mentee "Cancel" on one that had already run, both of which the server
 * refuses, while never offering the mentee the one thing she could do after
 * the hour: say it went ahead. The buttons now follow the same clock as the
 * server.
 *
 * When the mentor marks a paid session complete the card is not charged that
 * minute: the mentee has SESSION_CONFIRMATION_HOURS to say it did not happen,
 * and this page tells her when the charge falls and gives her the button. A
 * session she disputes, before or for DISPUTE_WINDOW_DAYS after the charge, is
 * frozen with the money held while ATHENA's team decides; the mentor can give
 * her side once from the same row. Older charges go to Help and Support.
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
import { cn } from '@/lib/utils';
import { PaymentIntentForm } from '@/components/payments/PaymentIntentForm';
import { DISPUTE_WINDOW_DAYS, SESSION_CONFIRMATION_HOURS } from '@/lib/pricing';

/** Help & Support, whose contact card reaches a person on the team. */
const HELP_LINK = '/dashboard/settings/help';

const DAY = 24 * 60 * 60 * 1000;

type Role = 'mentee' | 'mentor';
type Status = 'REQUESTED' | 'CONFIRMED' | 'CANCELED' | 'COMPLETED' | 'DISPUTED';

type Session = {
  id: string;
  scheduledAt: string | null;
  durationMinutes: number;
  status: Status;
  note: string | null;
  currency?: string;
  sessionAmount?: string | number;
  paymentStatus?: 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED' | 'CANCELED';
  /** When the card is charged for a session the mentor marked complete, unless the mentee objects first. */
  paymentReleaseAt?: string | null;
  paymentCapturedAt?: string | null;
  disputedAt?: string | null;
  disputeReason?: string | null;
  disputeResponse?: string | null;
  disputeResolution?: 'RELEASED' | 'REFUNDED' | null;
  /** The mentee's bank has disputed the payment, which is separate from her telling ATHENA. */
  cardDisputeOpen?: boolean;
  mentee?: { id: string; displayName: string | null; avatar: string | null };
  mentorProfile?: { id: string; user: { id: string; displayName: string | null; avatar: string | null } };
};

const STATUS: Record<Status, { label: string; className: string }> = {
  REQUESTED: { label: 'Requested', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' },
  COMPLETED: { label: 'Completed', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  CANCELED: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200' },
  DISPUTED: { label: 'In dispute', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
};

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

// Told from each side. The mentor was shown "Payment held on your card" about
// money on the mentee's card, which is not hers.
const PAYMENT: Record<Role, Record<string, string>> = {
  mentee: {
    PENDING: 'Payment not authorised yet. The request is cancelled if it is not paid for within a few hours.',
    AUTHORIZED: 'Payment held on your card',
    CAPTURED: 'Paid',
    REFUNDED: 'Refunded',
    FAILED: 'Payment failed',
    CANCELED: 'Payment released',
  },
  mentor: {
    PENDING: 'Waiting for the mentee to authorise payment',
    AUTHORIZED: 'Payment held on the mentee’s card',
    CAPTURED: 'Paid',
    REFUNDED: 'Refunded to the mentee',
    FAILED: 'Payment could not be collected',
    CANCELED: 'Payment released to the mentee',
  },
};

/**
 * Whether the booked time is over — the same test the server applies before
 * it lets anyone complete a session or refuses a mentee's cancellation. A
 * session with no time on it has not happened.
 */
function sessionHasEnded(session: Pick<Session, 'scheduledAt' | 'durationMinutes'>, now: number): boolean {
  if (!session.scheduledAt) return false;
  return new Date(session.scheduledAt).getTime() + session.durationMinutes * 60 * 1000 <= now;
}

/**
 * The session's own amount in its own currency, to the cent. The shared
 * formatter rounds to whole units in the viewer's preferred currency, which
 * showed a 45-minute session at A$37.50 as "$38" and a session booked in US
 * dollars under an Australian symbol — on the screen where she authorises the
 * charge.
 */
function formatSessionAmount(amount: number, currency: string | undefined): string {
  const code = (currency || 'AUD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

function counterpartOf(session: Session, role: Role) {
  const person = role === 'mentee' ? session.mentorProfile?.user : session.mentee;
  return { id: person?.id, name: person?.displayName || (role === 'mentee' ? 'Mentor' : 'Mentee'), avatar: person?.avatar || undefined };
}

/**
 * The mentee's account of what went wrong. The text lives here and not in the
 * page's state: Row is remade on every render of the page, so a keystroke held
 * by the page would remount the row and take the focus off the box she is
 * typing in.
 */
function DisputeForm({
  captured,
  busy,
  onSend,
  onCancel,
}: {
  captured: boolean;
  busy: boolean;
  onSend: (reason: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const reason = text.trim();
        if (!reason) return;
        onSend(reason);
      }}
      className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
    >
      <label className="block text-sm text-slate-700 dark:text-slate-300">
        <span className="mb-1 block font-medium">What went wrong?</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={2000}
          className="input w-full text-sm"
          placeholder="My mentor did not join, or the session was not what was agreed."
        />
      </label>
      <p className="text-xs text-slate-500">
        {captured
          ? 'The payment is not paid on to your mentor while ATHENA’s team looks at it.'
          : 'The hold stays on your card, and nothing is charged, while ATHENA’s team looks at it.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !text.trim()} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-60">
          Send to ATHENA’s team
        </button>
        <button type="button" onClick={onCancel} className="btn-outline px-3 py-1.5 text-sm">
          Keep it
        </button>
      </div>
    </form>
  );
}

/** The mentor's one answer to a session in dispute. Its text lives here for the same reason as DisputeForm's. */
function AnswerForm({ sessionId, busy, onSend }: { sessionId: string; busy: boolean; onSend: (response: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const response = text.trim();
        if (!response) return;
        onSend(response);
      }}
      className="mt-2 space-y-2"
    >
      <label htmlFor={`answer-${sessionId}`} className="block text-xs font-medium">
        Tell your side. You can answer once, and the team reads it.
      </label>
      <textarea id={`answer-${sessionId}`} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} className="input w-full text-sm" />
      <button type="submit" disabled={busy || !text.trim()} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-60">
        Send to the team
      </button>
    </form>
  );
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
  const [paying, setPaying] = useState<{ sessionId: string; clientSecret: string; amount: number; currency?: string } | null>(null);
  // The session the mentee is saying did not happen. What she writes stays in
  // DisputeForm, which is why this holds only the id.
  const [disputing, setDisputing] = useState<string | null>(null);
  const highlightRef = useRef<HTMLLIElement | null>(null);

  const profile = useQuery({
    queryKey: ['mentor-profile', user?.id],
    queryFn: () => mentorApi.getProfileByUser(user!.id),
    enabled: Boolean(user?.id) && isAuthenticated,
    retry: false,
    select: (response) => response.data as { id: string } | null,
  });
  const isMentor = Boolean(profile.data?.id);
  // A 404 is the answer "she has no mentor profile". Anything else is a
  // question that went unanswered, and hiding the "As a mentor" tab over it
  // would tell a mentor with requests waiting that she has none.
  const profileStatus = (profile.error as { response?: { status?: number } } | null)?.response?.status;
  const profileUnknown = profile.isError && profileStatus !== 404;

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

  const startPayment = useMutation({
    mutationFn: (sessionId: string) => mentorApi.paymentIntent(sessionId),
    onSuccess: (response, sessionId) => {
      const data = response.data?.data ?? {};
      if (!data.clientSecret) {
        toast.success(PAYMENT.mentee[data.paymentStatus] ?? 'Nothing to pay right now');
        refresh();
        return;
      }
      setPaying({ sessionId, clientSecret: data.clientSecret, amount: Number(data.amount ?? 0), currency: data.currency });
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not start the payment'),
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

  // Saying a session did not happen freezes it with the money held; the
  // server decides whether she may, and says why when she may not.
  const dispute = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => mentorApi.disputeSession(id, reason),
    onSuccess: () => {
      refresh();
      setDisputing(null);
      toast.success('Sent to ATHENA’s team. Nothing is paid on while they look at it.');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not send that to the team'),
  });

  const answer = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) => mentorApi.respondToSessionDispute(id, response),
    onSuccess: () => {
      refresh();
      toast.success('Your answer has been recorded for the team.');
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not record your answer'),
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

  // Completing is what moves the money, so each side is told what it does
  // before it happens: the mentee that her card is charged now, the mentor
  // that the mentee has a window to object before it is.
  const confirmComplete = (session: Session) => {
    const amount = session.sessionAmount !== undefined ? Number(session.sessionAmount) : 0;
    const held = amount > 0 && session.paymentStatus === 'AUTHORIZED';
    const question =
      role === 'mentee'
        ? held
          ? `Confirm this session went ahead? The ${formatSessionAmount(amount, session.currency)} held on your card is paid to your mentor now.`
          : 'Confirm this session went ahead?'
        : held
          ? `Mark this session complete? The mentee is told, and has ${SESSION_CONFIRMATION_HOURS} hours to say it did not happen; after that her card is charged ${formatSessionAmount(amount, session.currency)}.`
          : 'Mark this session complete? The mentee is told.';
    if (!window.confirm(question)) return;
    changeStatus.mutate({ id: session.id, status: 'COMPLETED' });
  };

  const Row = ({ session }: { session: Session }) => {
    const person = counterpartOf(session, role);
    const status = STATUS[session.status] ?? STATUS.REQUESTED;
    const open = session.status === 'REQUESTED' || session.status === 'CONFIRMED';
    const amount = session.sessionAmount !== undefined ? Number(session.sessionAmount) : null;
    const isHighlighted = highlighted === session.id;
    const ended = sessionHasEnded(session, Date.now());
    const canComplete = session.status === 'CONFIRMED' && ended;
    // Once a confirmed session's time has passed the server refuses the
    // mentee's cancellation: the hour may have run, so voiding it is the
    // mentor's call. A request the mentor never accepted she can always
    // withdraw. The mentor declines a request rather than cancelling it.
    const canCancel =
      role === 'mentee'
        ? session.status === 'REQUESTED' || (session.status === 'CONFIRMED' && !ended)
        : session.status === 'CONFIRMED';
    const menteeCannotCancel = role === 'mentee' && session.status === 'CONFIRMED' && ended;
    // The card step is still hers to finish: not yet attempted, or declined while
    // the request is still a request. The server hands out the card form's secret
    // for exactly these two (getSessionPaymentSecret).
    const cardStepOpen =
      session.paymentStatus === 'PENDING' || (session.paymentStatus === 'FAILED' && session.status === 'REQUESTED');
    // The server will not let a mentor accept a paid request until the mentee's
    // card is held, so the button says so instead of offering something that
    // answers with an error. Free sessions have no card to wait for.
    const awaitingPayment =
      role === 'mentor' &&
      session.status === 'REQUESTED' &&
      amount !== null &&
      amount > 0 &&
      session.paymentStatus !== 'AUTHORIZED' &&
      session.paymentStatus !== 'CAPTURED';
    const paidSession = amount !== null && amount > 0;
    const captured = session.paymentStatus === 'CAPTURED';
    const capturedAt = session.paymentCapturedAt ? new Date(session.paymentCapturedAt).getTime() : null;
    // The same rule the server applies (service-disputes.service): a charged
    // session can be reported from here for DISPUTE_WINDOW_DAYS after the
    // charge. A row with no charge date is left to the server to decide.
    const withinDisputeWindow = capturedAt === null || Date.now() - capturedAt <= DISPUTE_WINDOW_DAYS * DAY;
    // The mentor has marked it complete and the card is still held: the window
    // in which the mentee can object, ending when the charge falls.
    const windowEndsAt =
      session.status === 'COMPLETED' && session.paymentStatus === 'AUTHORIZED' && session.paymentReleaseAt
        ? new Date(session.paymentReleaseAt)
        : null;
    // The hour is over: the mentor or the mentee has closed it, or its booked
    // time has passed. The sweep can take the money for such a session before
    // anyone marks it complete (a hold about to lapse), so a confirmed session
    // already charged is reported the same way as a completed one.
    const hourOver = session.status === 'COMPLETED' || (session.status === 'CONFIRMED' && ended);
    // A dispute is raised once. After the team decides, the row keeps it, and
    // the decision is shown below instead of a second button the server refuses.
    const alreadyDisputed = Boolean(session.disputedAt) || Boolean(session.disputeResolution);
    const canDispute =
      role === 'mentee' &&
      paidSession &&
      !alreadyDisputed &&
      hourOver &&
      (session.paymentStatus === 'AUTHORIZED' || (captured && withinDisputeWindow));
    const wasCharged = role === 'mentee' && hourOver && captured && paidSession && !alreadyDisputed;
    const pastDisputeWindow = wasCharged && !withinDisputeWindow;
    const inDispute = session.status === 'DISPUTED';

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
                {amount !== null && amount > 0 && <span>{formatSessionAmount(amount, session.currency)}</span>}
              </div>
            </div>
          </div>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', status.className)}>{status.label}</span>
        </div>

        {session.note && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">{session.note}</p>}

        {session.paymentStatus && amount !== null && amount > 0 && (
          <p className={cn('text-xs', session.paymentStatus === 'PENDING' && open ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500')}>
            {role === 'mentee' && session.paymentStatus === 'FAILED' && cardStepOpen
              ? 'Payment failed. You can try another card; the request is cancelled if it is not paid for within a few hours.'
              : (PAYMENT[role][session.paymentStatus] ?? session.paymentStatus)}
          </p>
        )}

        {awaitingPayment && (
          <p id={`awaiting-payment-${session.id}`} className="text-xs text-slate-500 dark:text-slate-400">
            You can confirm this once the mentee has authorised payment, so you are sure to be paid. We will tell you when
            she has.
          </p>
        )}

        {windowEndsAt && amount !== null && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {role === 'mentee'
              ? `Your mentor marked this session complete. ${formatSessionAmount(amount, session.currency)} is charged on ${format(windowEndsAt, 'EEE d MMM, h:mm a')} unless you tell us before then that it did not take place.`
              : `Marked complete. The mentee’s card is charged ${formatSessionAmount(amount, session.currency)} on ${format(windowEndsAt, 'EEE d MMM, h:mm a')} unless she says the session did not take place.`}
          </p>
        )}

        {wasCharged && withinDisputeWindow && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            If this session did not take place, tell us below within {DISPUTE_WINDOW_DAYS} days of the charge and the team will
            look at it with you.
          </p>
        )}

        {pastDisputeWindow && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            If this session did not take place, contact the team from{' '}
            <Link href={HELP_LINK} className="text-primary-600 hover:underline">
              Help &amp; Support
            </Link>{' '}
            and they will look at a refund with you.
          </p>
        )}

        {menteeCannotCancel && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This session’s time has passed. If it went ahead, confirm it below. If it did not, say so below: the hold stays
            on your card, and nothing is charged, while the team looks at it.
          </p>
        )}

        {inDispute && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
            <p className="font-medium">
              {role === 'mentee' ? 'You told us this session did not take place.' : 'The mentee says this session did not take place.'}{' '}
              ATHENA’s team is looking at it.{' '}
              {paidSession
                ? 'The payment stays held and is not paid on until they decide, and neither of you can change the session meanwhile.'
                : 'Neither of you can change the session meanwhile.'}
            </p>
            {session.disputeReason && <p className="mt-1 whitespace-pre-wrap">“{session.disputeReason}”</p>}
            {session.disputeResponse ? (
              <p className="mt-2 whitespace-pre-wrap">
                <span className="font-medium">{role === 'mentor' ? 'Your answer' : 'Your mentor’s answer'}:</span> “{session.disputeResponse}”
              </p>
            ) : role === 'mentor' ? (
              <AnswerForm sessionId={session.id} busy={answer.isPending} onSend={(response) => answer.mutate({ id: session.id, response })} />
            ) : (
              <p className="mt-1 text-xs">Your mentor has not answered yet.</p>
            )}
          </div>
        )}

        {session.cardDisputeOpen && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {role === 'mentee'
              ? 'Your bank has opened a dispute on this payment. Nothing is paid on while that is open.'
              : 'The mentee’s bank has opened a dispute on this payment. Nothing is paid on while that is open.'}
          </p>
        )}

        {session.disputeResolution && !inDispute && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ATHENA’s team decided this:{' '}
            {session.disputeResolution === 'RELEASED' ? 'the payment was released to the mentor.' : 'the payment was given back to the mentee.'}
          </p>
        )}

        {paying?.sessionId === session.id && (
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <PaymentIntentForm
              clientSecret={paying.clientSecret}
              amountLabel={formatSessionAmount(paying.amount, paying.currency)}
              onAuthorised={() => {
                setPaying(null);
                refresh();
                toast.success('Payment authorised. It is charged when the session is completed.');
              }}
              onSkip={() => setPaying(null)}
              skipLabel="Not now"
            />
          </div>
        )}

        {open && (
          <div className="flex flex-wrap items-center gap-2">
            {role === 'mentor' && session.status === 'REQUESTED' && (
              <>
                <button
                  type="button"
                  onClick={() => changeStatus.mutate({ id: session.id, status: 'CONFIRMED' })}
                  disabled={changeStatus.isPending || awaitingPayment}
                  aria-describedby={awaitingPayment ? `awaiting-payment-${session.id}` : undefined}
                  className="btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="h-4 w-4" /> Confirm
                </button>
                <button type="button" onClick={() => confirmCancel(session)} disabled={changeStatus.isPending} className="btn-outline inline-flex items-center gap-1 px-3 py-1.5 text-sm">
                  <X className="h-4 w-4" /> Decline
                </button>
              </>
            )}
            {canComplete && (
              <button
                type="button"
                onClick={() => confirmComplete(session)}
                disabled={changeStatus.isPending}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                {role === 'mentee' ? 'It went ahead' : 'Mark complete'}
              </button>
            )}
            {role === 'mentee' && cardStepOpen && amount !== null && amount > 0 && paying?.sessionId !== session.id && (
              <button
                type="button"
                onClick={() => startPayment.mutate(session.id)}
                disabled={startPayment.isPending}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                {session.paymentStatus === 'FAILED' ? 'Try another card' : 'Authorise payment'}
              </button>
            )}
            {canCancel && (
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

        {canDispute && disputing !== session.id && (
          <button
            type="button"
            onClick={() => setDisputing(session.id)}
            disabled={dispute.isPending}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300"
          >
            It did not happen
          </button>
        )}

        {disputing === session.id && (
          <DisputeForm
            captured={captured}
            busy={dispute.isPending}
            onSend={(reason) => dispute.mutate({ id: session.id, reason })}
            onCancel={() => setDisputing(null)}
          />
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

      {profileUnknown && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          <span>We could not check your mentor profile, so any sessions you give as a mentor are not shown here yet.</span>
          <button type="button" onClick={() => profile.refetch()} className="font-medium underline">
            Try again
          </button>
        </div>
      )}

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
      ) : sessions.isError ? (
        // A list that could not be read used to fall through to "Nothing
        // booked", telling a member with a paid session tomorrow that she had
        // none.
        <div role="alert" className="card space-y-3 p-6 text-sm text-slate-600 dark:text-slate-300">
          <p>We could not load your sessions just now. Nothing has been changed.</p>
          <button type="button" onClick={() => sessions.refetch()} className="btn-outline px-3 py-1.5 text-sm">
            Try again
          </button>
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

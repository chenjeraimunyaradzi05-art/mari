'use client';

/**
 * Safety reports awaiting a decision, and why a member's safety score is what
 * it is.
 *
 * Every report and every block writes a SafetyIncident, and every one moves the
 * reported member's safety score. The server can decide a report — upheld, it
 * counts as a verified report; dismissed, it stops counting against her — and
 * can explain a score factor by factor, but no staff screen called either, so
 * an unfounded report counted against a member for ever and a moderator opening
 * a SAFETY_CRITICAL flag had a number and no reasons. These are those screens.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { Gauge, Loader2, Scale } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type IncidentPerson = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  isSuspended?: boolean;
};

type SafetyIncidentRow = {
  id: string;
  severity: string;
  reason: string | null;
  contentType: string | null;
  contentId: string | null;
  createdAt: string;
  decided: boolean;
  upheld: boolean | null;
  member: IncidentPerson | null;
  reporter: IncidentPerson | null;
};

type ScoreFactor = { category: string; impact: number; details: string };

type SafetyScoreView = {
  member: IncidentPerson;
  stored: { score: number; level: string; assessedAt: string | null };
  current: { score: number; riskLevel: string; factors: ScoreFactor[]; restrictions: string[]; lastUpdated: string };
};

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

function personName(person: IncidentPerson | null | undefined): string {
  if (!person) return 'Account no longer on the platform';
  return person.displayName?.trim() || [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || 'Member';
}

export function SafetyIncidentsPanel({ onShowScore }: { onShowScore: (userId: string) => void }) {
  const queryClient = useQueryClient();
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const incidents = useQuery({
    queryKey: ['admin-safety-incidents'],
    queryFn: () => api.get('/safety/moderation/incidents', { params: { status: 'open', limit: 50 } }),
    select: (response) => ({
      incidents: (Array.isArray(response.data?.data) ? response.data.data : []) as SafetyIncidentRow[],
      openCount: Number(response.data?.openCount ?? 0),
    }),
  });

  const decide = useMutation({
    mutationFn: ({ id, upheld }: { id: string; upheld: boolean }) =>
      api.post(`/safety/moderation/incidents/${id}/decision`, { upheld, ...(note.trim() ? { notes: note.trim() } : {}) }),
    onSuccess: (response, { upheld }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-safety-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['admin-safety-score'] });
      setDecidingId(null);
      setNote('');
      const score = response.data?.data?.score;
      toast.success(
        `${upheld ? 'Upheld' : 'Dismissed'}${typeof score === 'number' ? ` — her safety score is now ${score}` : ''}`
      );
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not record that decision'),
  });

  return (
    <section id="safety-reports" className="mb-8 scroll-mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Scale className="h-5 w-5 text-violet-600" /> Reports awaiting a decision
        </h2>
        {incidents.data && incidents.data.openCount > 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{incidents.data.openCount} waiting</p>
        )}
      </div>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        Each of these is counting against a member&apos;s safety score until someone decides it. Uphold one that is
        founded; dismiss one that is not, and it stops counting against her.
      </p>

      {incidents.isLoading ? (
        <div className="flex justify-center rounded-xl border border-slate-200 bg-white py-8 dark:border-slate-700 dark:bg-slate-900">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : incidents.isError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          These reports could not be loaded. Do not read that as nothing waiting — refresh, and tell an administrator if
          it keeps failing.
        </div>
      ) : incidents.data && incidents.data.incidents.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          Nothing waiting for a decision.
        </div>
      ) : (
        <ul className="space-y-3">
          {(incidents.data?.incidents ?? []).map((incident) => (
            <li key={incident.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {incident.severity}
                </span>
                <span className="font-medium text-slate-900 dark:text-white">{incident.reason ?? 'No reason given'}</span>
                {incident.contentType && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {incident.contentType}
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                About{' '}
                {incident.member ? (
                  <Link href={`/profile/${incident.member.id}`} className="font-medium hover:underline">
                    {personName(incident.member)}
                  </Link>
                ) : (
                  <span className="font-medium">{personName(null)}</span>
                )}
                {incident.member?.isSuspended && <span className="ml-1 text-xs text-red-600">suspended</span>} · reported by{' '}
                {personName(incident.reporter)}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {incident.member && (
                  <button
                    type="button"
                    onClick={() => onShowScore(incident.member!.id)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
                  >
                    <Gauge className="h-4 w-4" /> Her safety score
                  </button>
                )}
                {decidingId !== incident.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setDecidingId(incident.id);
                      setNote('');
                    }}
                    className="text-sm font-medium text-violet-700 hover:underline dark:text-violet-300"
                  >
                    Decide this report
                  </button>
                )}
              </div>

              {decidingId === incident.id && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="Why you decided this (kept with the decision)"
                    aria-label="Why you decided this report"
                    className="input w-full text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: incident.id, upheld: true })}
                      className="btn-outline px-3 py-1.5 text-sm text-red-700"
                    >
                      Uphold
                    </button>
                    <button
                      type="button"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: incident.id, upheld: false })}
                      className="btn-outline px-3 py-1.5 text-sm"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDecidingId(null);
                        setNote('');
                      }}
                      className="text-sm text-slate-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The stored score beside the live breakdown.
 *
 * The stored score is what the rest of the platform acts on; the breakdown is
 * worked out now from the same inputs. They can differ when something changed
 * since the last recalculation, so the two are shown side by side and labelled,
 * never merged into one number that is neither.
 */
export function MemberSafetyScore({ userId, onClose }: { userId: string; onClose: () => void }) {
  const score = useQuery({
    queryKey: ['admin-safety-score', userId],
    queryFn: () => api.get(`/safety/moderation/members/${userId}/safety-score`),
    select: (response) => response.data?.data as SafetyScoreView | undefined,
  });

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <Gauge className="h-4 w-4 text-violet-600" />
          {score.data ? `Safety score: ${personName(score.data.member)}` : 'Safety score'}
        </h3>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:underline">
          Close
        </button>
      </div>

      {score.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
        </div>
      ) : score.isError || !score.data ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {errorMessage(score.error) || 'The score could not be loaded. Refresh and try again.'}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Stored score (what the platform acts on)</dt>
              <dd className="text-lg font-semibold text-slate-900 dark:text-white">
                {score.data.stored.score} <span className="text-xs font-normal text-slate-500">{score.data.stored.level.toLowerCase()}</span>
              </dd>
              {score.data.stored.assessedAt && (
                <dd className="text-xs text-slate-500">
                  assessed {formatDistanceToNow(new Date(score.data.stored.assessedAt), { addSuffix: true })}
                </dd>
              )}
            </div>
            <div>
              <dt className="text-xs text-slate-500">Worked out now</dt>
              <dd className="text-lg font-semibold text-slate-900 dark:text-white">
                {score.data.current.score}{' '}
                <span className="text-xs font-normal text-slate-500">{score.data.current.riskLevel.toLowerCase()}</span>
              </dd>
            </div>
          </dl>

          <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Why</p>
          {score.data.current.factors.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">Nothing is moving this score from where every member starts.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {score.data.current.factors.map((factor, index) => (
                <li key={`${factor.category}-${index}`} className="flex justify-between gap-3">
                  <span className="text-slate-700 dark:text-slate-300">{factor.details}</span>
                  <span className={cn('font-mono', factor.impact < 0 ? 'text-red-600' : 'text-emerald-600')}>
                    {factor.impact > 0 ? `+${factor.impact}` : factor.impact}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {score.data.current.restrictions.length > 0 && (
            <>
              <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Restrictions this score brings</p>
              <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
                {score.data.current.restrictions.map((restriction) => (
                  <li key={restriction}>{restriction}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

'use client';

/**
 * The referee's form. A referee arrives here from the email the candidate's
 * request sent them; the link carries a single-use token and needs no
 * account. The questions come from the request (professional, character or
 * employment verification), plus an overall rating and whether they would
 * recommend. They can also decline.
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import { referenceApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Question = { id: string; question: string; type: 'TEXT' | 'RATING' | 'YES_NO' | 'MULTIPLE_CHOICE'; options?: string[]; required: boolean };
type FormData = {
  request: { id: string; refereeName: string; relationship: string; type: string; status: string; questions: Question[]; expiresAt?: string };
  candidate: { displayName?: string | null; firstName?: string | null; lastName?: string | null; avatar?: string | null; headline?: string | null };
  expired: boolean;
};

const errorStatus = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

export default function ReferenceFormPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comments, setComments] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);
  const [done, setDone] = useState<'submitted' | 'declined' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const form = useQuery({
    queryKey: ['reference-form', token],
    queryFn: () => referenceApi.form(token),
    enabled: Boolean(token),
    retry: false,
    select: (response) => response.data?.data as FormData,
  });

  const submit = useMutation({
    mutationFn: () =>
      referenceApi.submit(token, {
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        overallRating: overallRating ?? undefined,
        wouldRecommend: wouldRecommend === true,
        additionalComments: comments.trim() || undefined,
      }),
    onSuccess: () => setDone('submitted'),
    onError: (error) => setProblem(errorMessage(error) || 'Your reference could not be saved. Please try again.'),
  });

  const decline = useMutation({
    mutationFn: () => referenceApi.decline(token, declineReason.trim() || undefined),
    onSuccess: () => setDone('declined'),
    onError: (error) => setProblem(errorMessage(error) || 'Could not record that. Please try again.'),
  });

  const candidateName = (data: FormData) =>
    data.candidate?.displayName?.trim() || [data.candidate?.firstName, data.candidate?.lastName].filter(Boolean).join(' ').trim() || 'the candidate';

  if (form.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (form.isError || !form.data) {
    const status = errorStatus(form.error);
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          {status === 410 ? 'This reference request has expired' : 'This link is not valid'}
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {status === 410
            ? 'The candidate can send a fresh request from their ATHENA account.'
            : 'Check the link in your email, or ask the candidate to send the request again.'}
        </p>
      </div>
    );
  }

  const data = form.data;
  const name = candidateName(data);

  if (done || data.request.status === 'COMPLETED') {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h1 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
          {done === 'declined' ? 'Thank you for letting us know' : 'Thank you'}
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {done === 'declined' ? `${name} will be told you were not able to provide a reference.` : `Your reference for ${name} has been recorded.`}
        </p>
      </div>
    );
  }

  const questions = Array.isArray(data.request.questions) ? data.request.questions : [];
  const missingRequired = questions.some((q) => q.required && (answers[q.id] === undefined || answers[q.id] === ''));
  const canSubmit = !missingRequired && wouldRecommend !== null && !submit.isPending;

  const set = (id: string, value: string | number | boolean) => setAnswers((current) => ({ ...current, [id]: value }));

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference request</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">A reference for {name}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          {data.request.refereeName ? `Hello ${data.request.refereeName}. ` : ''}
          {name} has named you as a referee{data.candidate?.headline ? ` (${data.candidate.headline})` : ''}. Your answers go to {name} and the
          employer they are applying to, nowhere else.
        </p>
        {data.request.expiresAt && (
          <p className="mt-1 text-xs text-slate-500">This link works until {new Date(data.request.expiresAt).toLocaleDateString('en-AU', { dateStyle: 'long' })}.</p>
        )}
      </header>

      {problem && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {problem}
        </div>
      )}

      {declining ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            decline.mutate();
          }}
          className="card space-y-3"
        >
          <h2 className="font-semibold text-slate-900 dark:text-white">Not able to provide a reference?</h2>
          <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={3} maxLength={500} placeholder="A reason is optional." className="input w-full" />
          <div className="flex gap-2">
            <button type="submit" disabled={decline.isPending} className="btn-primary px-4 py-2 text-sm">
              Decline the request
            </button>
            <button type="button" onClick={() => setDeclining(false)} className="btn-outline px-4 py-2 text-sm">
              Back to the form
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) submit.mutate();
          }}
          className="space-y-6"
        >
          {questions.map((q, index) => (
            <fieldset key={q.id} className="card space-y-2">
              <legend className="text-sm font-medium text-slate-900 dark:text-white">
                {index + 1}. {q.question}
                {q.required && <span className="text-red-600"> *</span>}
              </legend>
              {q.type === 'TEXT' && (
                <textarea value={String(answers[q.id] ?? '')} onChange={(e) => set(q.id, e.target.value)} rows={3} maxLength={2000} className="input w-full" />
              )}
              {q.type === 'RATING' && (
                <div className="flex gap-1" role="radiogroup" aria-label={q.question}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={answers[q.id] === n}
                      aria-label={`${n} of 5`}
                      onClick={() => set(q.id, n)}
                      className="p-1"
                    >
                      <Star className={cn('h-6 w-6', typeof answers[q.id] === 'number' && (answers[q.id] as number) >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
                    </button>
                  ))}
                </div>
              )}
              {q.type === 'YES_NO' && (
                <div className="flex gap-2">
                  {[
                    [true, 'Yes'],
                    [false, 'No'],
                  ].map(([value, label]) => (
                    <button
                      key={String(value)}
                      type="button"
                      aria-pressed={answers[q.id] === value}
                      onClick={() => set(q.id, value as boolean)}
                      className={cn('rounded-lg border px-4 py-1.5 text-sm', answers[q.id] === value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600')}
                    >
                      {label as string}
                    </button>
                  ))}
                </div>
              )}
              {q.type === 'MULTIPLE_CHOICE' && (
                <select value={String(answers[q.id] ?? '')} onChange={(e) => set(q.id, e.target.value)} className="input w-full">
                  <option value="">Choose one</option>
                  {(q.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </fieldset>
          ))}

          <fieldset className="card space-y-3">
            <legend className="text-sm font-medium text-slate-900 dark:text-white">Overall</legend>
            <div>
              <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">How would you rate {name} overall?</p>
              <div className="flex gap-1" role="radiogroup" aria-label="Overall rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={overallRating === n} aria-label={`${n} of 5`} onClick={() => setOverallRating(n)} className="p-1">
                    <Star className={cn('h-7 w-7', overallRating !== null && overallRating >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">
                Would you recommend {name}? <span className="text-red-600">*</span>
              </p>
              <div className="flex gap-2">
                {[
                  [true, 'Yes'],
                  [false, 'No'],
                ].map(([value, label]) => (
                  <button
                    key={String(value)}
                    type="button"
                    aria-pressed={wouldRecommend === value}
                    onClick={() => setWouldRecommend(value as boolean)}
                    className={cn('rounded-lg border px-4 py-1.5 text-sm', wouldRecommend === value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-600')}
                  >
                    {label as string}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600 dark:text-slate-300">Anything else the employer should know?</span>
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} maxLength={2000} className="input w-full" />
            </label>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!canSubmit} className="btn-primary px-5 py-2.5">
              {submit.isPending ? 'Sending…' : 'Submit reference'}
            </button>
            <button type="button" onClick={() => setDeclining(true)} className="text-sm text-slate-500 hover:underline">
              I am not able to provide a reference
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

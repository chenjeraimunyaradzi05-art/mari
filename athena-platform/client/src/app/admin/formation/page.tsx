'use client';

/**
 * The formation review queue.
 *
 * A woman pays A$49 to A$699 to register a business, and the registration
 * walks itself as far as "submitted". Everything after that needs a person,
 * and until this page there was no screen, no route and no code path that
 * could provide one: the queue filled up, nobody was told, and the money sat
 * against registrations that could never be approved, refused or refunded.
 *
 * Every button here goes through the server's state machine, so each
 * decision writes state history and notifies the applicant. Refusing a
 * registration refunds the fee first, and will not record the refusal if the
 * refund does not go through.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import {
  adminFormationApi,
  type FormationDecision,
  type FormationQueueStatus,
  type FormationRegistration,
} from '@/lib/formation-admin-api';
import { cn } from '@/lib/utils';

const errorMessage = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

const STAGES: Array<[FormationQueueStatus | 'ALL', string]> = [
  ['ALL', 'Everything waiting'],
  ['SUBMITTED', 'New'],
  ['UNDER_REVIEW', 'Being reviewed'],
  ['ADDITIONAL_INFO_REQUIRED', 'Waiting on her'],
  ['APPROVED', 'Awaiting certificate'],
];

/**
 * What can be done from each stage, in the state machine's own terms. The
 * server refuses an impossible move anyway; showing only the possible ones
 * saves a reviewer from finding out by being told no.
 */
const ACTIONS: Record<string, FormationDecision[]> = {
  SUBMITTED: ['MARK_UNDER_REVIEW'],
  UNDER_REVIEW: ['REQUEST_INFO', 'APPROVE', 'REJECT'],
  ADDITIONAL_INFO_REQUIRED: [],
  APPROVED: ['COMPLETE'],
};

const ACTION_LABELS: Record<FormationDecision, string> = {
  MARK_UNDER_REVIEW: 'Start reviewing',
  REQUEST_INFO: 'Ask for more',
  APPROVE: 'Approve',
  REJECT: 'Refuse and refund',
  COMPLETE: 'Mark complete',
};

/** Which extra fields a decision cannot be made without. */
const NEEDS: Record<FormationDecision, Array<'note' | 'registrationNumber' | 'abn' | 'acn' | 'certificateUrl'>> = {
  MARK_UNDER_REVIEW: [],
  REQUEST_INFO: ['note'],
  APPROVE: ['registrationNumber', 'abn', 'acn'],
  REJECT: ['note'],
  COMPLETE: ['certificateUrl'],
};

const NOTE_LABEL: Partial<Record<FormationDecision, string>> = {
  REQUEST_INFO: 'What is missing (she sees this word for word)',
  REJECT: 'Why it was refused (she sees this, and the fee goes back)',
};

const feeCents = (registration: FormationRegistration): number | null => {
  const value = registration.data?.formationFeeCents;
  return typeof value === 'number' ? value : null;
};

const refundOf = (registration: FormationRegistration): Record<string, unknown> | null => {
  const value = registration.data?.refund;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
};

const aud = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const waited = (registration: FormationRegistration) => {
  const since = registration.submittedAt ?? registration.createdAt;
  return formatDistanceToNow(new Date(since), { addSuffix: true });
};

export default function AdminFormationPage() {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<FormationQueueStatus | 'ALL'>('ALL');
  const [open, setOpen] = useState<{ id: string; decision: FormationDecision } | null>(null);
  const [note, setNote] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [abn, setAbn] = useState('');
  const [acn, setAcn] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');

  const queue = useQuery({
    queryKey: ['admin-formation-queue', stage],
    queryFn: () => adminFormationApi.queue(stage === 'ALL' ? undefined : stage),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as FormationRegistration[]) : []),
  });

  const closeForm = () => {
    setOpen(null);
    setNote('');
    setRegistrationNumber('');
    setAbn('');
    setAcn('');
    setCertificateUrl('');
  };

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: FormationDecision }) =>
      adminFormationApi.decide(id, {
        decision,
        note: note.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
        abn: abn.trim() || undefined,
        acn: acn.trim() || undefined,
        certificateUrl: certificateUrl.trim() || undefined,
      }),
    onSuccess: (_result, { decision }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-formation-queue'] });
      toast.success(
        decision === 'REJECT'
          ? 'Refused, and the fee has been refunded.'
          : decision === 'APPROVE'
            ? 'Approved. She has been told and the number is on the record.'
            : 'Saved. She has been told.'
      );
      closeForm();
    },
    onError: (error) => toast.error(errorMessage(error) || 'That decision could not be recorded'),
  });

  const rows = queue.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:underline dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>
        <div className="mt-2 flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <Building2 className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Formation</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Registrations waiting on a person</h1>
        <p className="mt-1 max-w-2xl text-slate-500 dark:text-slate-400">
          Each of these has paid its fee. Refusing one refunds it automatically; nothing is recorded as refused until the money is on its way back.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STAGES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStage(value)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm',
              stage === value
                ? 'border-rose-300 bg-rose-50 font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {queue.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : queue.isError ? (
        <p className="rounded-2xl border border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          The queue could not be loaded just now.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 p-10 text-center dark:border-slate-800">
          <p className="font-semibold text-slate-900 dark:text-white">Nothing waiting</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every paid registration has been dealt with.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((registration) => {
            const fee = feeCents(registration);
            const refund = refundOf(registration);
            const actions = ACTIONS[registration.status] ?? [];
            const form = open?.id === registration.id ? open.decision : null;

            return (
              <li key={registration.id} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {registration.businessName || 'Untitled registration'}
                      <span className="ml-2 text-sm font-normal text-slate-400">{registration.type.replace(/_/g, ' ').toLowerCase()}</span>
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {registration.user.displayName || registration.user.email} · waiting {waited(registration)}
                      {fee !== null ? ` · ${aud(fee)} paid` : ''}
                    </p>
                    {(registration.abn || registration.acn) && (
                      <p className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {registration.abn ? `ABN ${registration.abn}` : ''}
                        {registration.abn && registration.acn ? ' · ' : ''}
                        {registration.acn ? `ACN ${registration.acn}` : ''}
                      </p>
                    )}
                    {refund && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        Refunded{typeof refund.at === 'string' ? ` ${refund.at.slice(0, 10)}` : ''}
                        {typeof refund.reason === 'string' ? ` — ${refund.reason}` : ''}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {registration.status.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </div>

                {actions.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {actions.map((decision) => (
                      <button
                        key={decision}
                        type="button"
                        onClick={() => {
                          closeForm();
                          if (NEEDS[decision].length === 0) {
                            decide.mutate({ id: registration.id, decision });
                          } else {
                            setOpen({ id: registration.id, decision });
                          }
                        }}
                        disabled={decide.isPending}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50',
                          decision === 'REJECT'
                            ? 'border-rose-200 text-rose-700 dark:border-rose-800 dark:text-rose-300'
                            : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'
                        )}
                      >
                        {ACTION_LABELS[decision]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    She is answering the question you sent. It comes back here when she does.
                  </p>
                )}

                {form && (
                  <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                    {NEEDS[form].includes('note') && (
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{NOTE_LABEL[form]}</span>
                        <textarea
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          rows={3}
                          className="input w-full text-sm"
                        />
                      </label>
                    )}

                    {NEEDS[form].includes('registrationNumber') && (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">ASIC or ABR number</span>
                          <input value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} className="input w-full text-sm" />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">ABN (optional)</span>
                          <input value={abn} onChange={(event) => setAbn(event.target.value)} className="input w-full text-sm" inputMode="numeric" />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            ACN{registration.type === 'COMPANY' ? '' : ' (optional)'}
                          </span>
                          <input value={acn} onChange={(event) => setAcn(event.target.value)} className="input w-full text-sm" inputMode="numeric" />
                        </label>
                      </div>
                    )}

                    {NEEDS[form].includes('certificateUrl') && (
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Certificate link</span>
                        <input value={certificateUrl} onChange={(event) => setCertificateUrl(event.target.value)} className="input w-full text-sm" placeholder="https://" />
                      </label>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => decide.mutate({ id: registration.id, decision: form })}
                        disabled={decide.isPending}
                        className="btn-primary py-2 text-sm disabled:opacity-50"
                      >
                        {decide.isPending ? 'Saving…' : ACTION_LABELS[form]}
                      </button>
                      <button type="button" onClick={closeForm} className="rounded-md border px-3 py-2 text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

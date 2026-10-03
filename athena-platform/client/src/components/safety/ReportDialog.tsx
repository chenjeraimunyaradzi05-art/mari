'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/modal';
import { safetyApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { nextStepsFor } from '@/lib/report-next-steps';
import { ReportNextSteps } from './ReportNextSteps';

/**
 * One report form for every social surface. It posts to POST /safety/reports,
 * which is what the reels player already used; posts and profiles now go
 * through the same dialog rather than each inventing a prompt of their own.
 */

type ReportTargetType =
  | 'post'
  | 'comment'
  | 'video'
  | 'user'
  | 'message'
  | 'group_message'
  | 'group'
  | 'livestream'
  | 'live_message'
  | 'channel'
  | 'housing_listing';

const REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate or discrimination' },
  { value: 'sexual', label: 'Sexual or explicit content' },
  // The two a woman is most likely to be reporting about herself, named so that
  // she does not have to guess which of the others they come under. They are read
  // first, hidden at once and seen by a person within hours (the server's intake).
  { value: 'intimate_image', label: 'An intimate image of someone, shared without consent' },
  { value: 'threat', label: 'A threat to hurt someone' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'impersonation', label: 'Impersonation or a fake account' },
  { value: 'other', label: 'Something else' },
];

const TITLES: Record<ReportTargetType, string> = {
  post: 'Report this post',
  comment: 'Report this comment',
  video: 'Report this reel',
  user: 'Report this member',
  message: 'Report this message',
  group_message: 'Report this message',
  group: 'Report this group',
  livestream: 'Report this stream',
  live_message: 'Report this chat message',
  channel: 'Report this channel',
  housing_listing: 'Report this listing',
};

// A message can be unsent, can disappear, or can be deleted by a host, so a report
// of one keeps a copy of it with the few lines before it. Said plainly, because
// she is entitled to know who will see what she reports from a private thread.
const KEEPS_A_COPY: Partial<Record<ReportTargetType, string>> = {
  message: 'We keep a copy of this message and the few before it, so our team can see what happened even if it is deleted. Only our safety team sees them.',
  group_message: 'We keep a copy of this message and the few before it, so our team can see what happened even if it is deleted. Only our safety team sees them.',
  live_message: 'We keep a copy of this message and the few before it, so our team can see what happened even if the host deletes it.',
};

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** Shown in the description so the reader knows what they are reporting. */
  targetLabel?: string;
}

export function ReportDialog({ open, onClose, targetType, targetId, targetLabel }: ReportDialogProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // The reason she just filed, kept while the confirmation is up so it can say
  // where else to turn; null when there is nothing more to say.
  const [filedReason, setFiledReason] = useState<string | null>(null);

  const close = () => {
    if (submitting) return;
    setReason('');
    setDetails('');
    setFiledReason(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason) {
      toast.error('Choose a reason first');
      return;
    }

    setSubmitting(true);
    try {
      await safetyApi.createReport({
        targetType,
        targetId,
        reason,
        details: details.trim() || undefined,
      });
      toast.success('Thanks. Our safety team will take a look.');
      setReason('');
      setDetails('');
      // A report that has somewhere else to go (an intimate image, a threat) is
      // answered with it, in the dialog, before it closes: she was told only
      // "thanks" and left to find the eSafety Commissioner and the police alone.
      if (nextStepsFor(reason)) {
        setFiledReason(reason);
      } else {
        onClose();
      }
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not send the report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={close}
      title={TITLES[targetType]}
      description={
        targetLabel
          ? `Tell us what is wrong with ${targetLabel}. Reports are private.`
          : 'Tell us what is wrong. Reports are private.'
      }
      size="md"
    >
      {filedReason ? (
        <div className="space-y-4 p-6">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Thank you. Your report is with our safety team, and we look at one like this first.
          </p>
          <ReportNextSteps reason={filedReason} />
          <div className="flex justify-end">
            <button type="button" onClick={close} className="btn-primary px-4 py-2">
              Done
            </button>
          </div>
        </div>
      ) : (
      <form onSubmit={submit} className="space-y-4 p-6">
        {KEEPS_A_COPY[targetType] && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {KEEPS_A_COPY[targetType]}
          </p>
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-900 dark:text-white">Reason</legend>
          {REASONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition',
                reason === option.value
                  ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <input
                type="radio"
                name="report-reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="text-rose-600"
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        <label className="block">
          <span className="text-sm font-medium text-slate-900 dark:text-white">Anything else? (optional)</span>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What happened, or where to look."
            className="input mt-1 w-full"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="btn-outline px-4 py-2" disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn-primary px-4 py-2" disabled={submitting || !reason}>
            {submitting ? 'Sending...' : 'Send report'}
          </button>
        </div>
      </form>
      )}
    </Modal>
  );
}

export default ReportDialog;

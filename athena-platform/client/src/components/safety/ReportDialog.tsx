'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/modal';
import { safetyApi } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * One report form for every social surface. It posts to POST /safety/reports,
 * which is what the reels player already used; posts and profiles now go
 * through the same dialog rather than each inventing a prompt of their own.
 */

type ReportTargetType = 'post' | 'video' | 'user' | 'message' | 'channel';

const REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate or discrimination' },
  { value: 'sexual', label: 'Sexual or explicit content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'impersonation', label: 'Impersonation or a fake account' },
  { value: 'other', label: 'Something else' },
];

const TITLES: Record<ReportTargetType, string> = {
  post: 'Report this post',
  video: 'Report this reel',
  user: 'Report this member',
  message: 'Report this message',
  channel: 'Report this channel',
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

  const close = () => {
    if (submitting) return;
    setReason('');
    setDetails('');
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
      onClose();
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
      <form onSubmit={submit} className="space-y-4 p-6">
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
    </Modal>
  );
}

export default ReportDialog;

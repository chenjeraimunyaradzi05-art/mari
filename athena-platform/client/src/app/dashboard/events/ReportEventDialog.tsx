'use client';

/**
 * Reporting an event.
 *
 * Members can host events, and until 2026-09 there was no way to report one:
 * `POST /safety/reports` accepted post, comment, video, user, message and
 * channel, and an event fell through to "We could not find the content you
 * reported". So a listing that lured women to a place, or that carried an
 * abusive description, could only be dealt with by an admin who happened to
 * notice it.
 *
 * This is a copy of the shared ReportDialog's form rather than a use of it,
 * because that component's `targetType` union is closed and events are the
 * first non-social surface to need reporting. If a third surface follows,
 * widen the shared dialog and delete this.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate or discrimination' },
  { value: 'sexual', label: 'Sexual or explicit content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'unsafe', label: 'This event does not look safe' },
  { value: 'impersonation', label: 'Impersonation or a fake organiser' },
  { value: 'other', label: 'Something else' },
];

interface ReportEventDialogProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
}

export function ReportEventDialog({ open, onClose, eventId, eventTitle }: ReportEventDialogProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    setReason('');
    setDetails('');
    onClose();
  };

  const submit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    if (!reason) {
      toast.error('Choose a reason first');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/safety/reports', {
        targetType: 'event',
        targetId: eventId,
        reason,
        details: details.trim() || undefined,
      });
      toast.success('Thanks. Our safety team will take a look.');
      setReason('');
      setDetails('');
      onClose();
    } catch (error) {
      const payload = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      toast.error(payload?.error || payload?.message || 'Could not send the report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={close}
      title="Report this event"
      description={`Tell us what is wrong with "${eventTitle}". Reports are private.`}
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
                name="report-event-reason"
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
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What happened, or what worries you about this listing."
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

export default ReportEventDialog;

'use client';

/**
 * Changing an event you host.
 *
 * A member could write a listing and then do nothing more with it: a venue
 * that fell through or a joining link that changed had no way into the
 * product. This sends only what she changed to PATCH /api/events/:id, and says
 * plainly what the server will do with it — a change to what the listing says
 * or where it sends people puts a published listing back in front of a
 * moderator, and everyone registered is told when the date, time or place
 * moves.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';

export type HostedEvent = {
  id: string;
  title: string;
  description: string;
  format: 'virtual' | 'in-person' | 'hybrid';
  date: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  link?: string | null;
  maxAttendees?: number | null;
  price: number | null;
  attendees: number;
  pendingReview?: boolean;
};

type Form = {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  link: string;
  maxAttendees: string;
  price: string;
};

function formFrom(event: HostedEvent): Form {
  return {
    title: event.title,
    description: event.description,
    date: event.date.slice(0, 10),
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location ?? '',
    link: event.link ?? '',
    maxAttendees: event.maxAttendees == null ? '' : String(event.maxAttendees),
    price: event.price == null ? '' : String(event.price),
  };
}

function apiMessage(error: unknown, fallback: string): string {
  const payload = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return payload?.message || payload?.error || fallback;
}

export function EditHostedEventDialog({ event, onClose }: { event: HostedEvent | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form | null>(event ? formFrom(event) : null);

  useEffect(() => {
    setForm(event ? formFrom(event) : null);
  }, [event]);

  const save = useMutation({
    mutationFn: (changes: Record<string, unknown>) => api.patch(`/events/${event!.id}`, changes),
    onSuccess: (response) => {
      const updated = response.data?.data as { pendingReview?: boolean } | undefined;
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(
        updated?.pendingReview && !event?.pendingReview
          ? 'Saved. The listing is held until a moderator has read the change.'
          : 'Saved.'
      );
      onClose();
    },
    onError: (error) => toast.error(apiMessage(error, 'The changes could not be saved. Nothing was changed.')),
  });

  if (!event || !form) return null;
  const original = formFrom(event);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const changes: Record<string, unknown> = {};
    (Object.keys(form) as Array<keyof Form>).forEach((key) => {
      if (form[key] !== original[key]) changes[key] = form[key];
    });
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    save.mutate(changes);
  };

  return (
    <Modal isOpen onClose={() => !save.isPending && onClose()} title="Change your event" size="lg">
      <form onSubmit={submit} className="space-y-4 p-6">
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Changing the title, description, place, link or price of a published listing sends it back to a moderator
          before it reappears. Changing the date, times or number of places does not. Everyone registered is told in
          the app when the date, time or place changes.
        </p>

        <label className="block">
          <span className="text-sm font-medium text-slate-900 dark:text-white">Title</span>
          <input value={form.title} onChange={set('title')} maxLength={120} required className="input mt-1 w-full" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-900 dark:text-white">Description</span>
          <textarea value={form.description} onChange={set('description')} maxLength={4000} rows={4} required className="input mt-1 w-full" />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-900 dark:text-white">Date</span>
            <input type="date" value={form.date} onChange={set('date')} required className="input mt-1 w-full" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-900 dark:text-white">Starts</span>
            <input type="time" value={form.startTime} onChange={set('startTime')} required className="input mt-1 w-full" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-900 dark:text-white">Ends</span>
            <input type="time" value={form.endTime} onChange={set('endTime')} required className="input mt-1 w-full" />
          </label>
        </div>

        {event.format !== 'virtual' && (
          <label className="block">
            <span className="text-sm font-medium text-slate-900 dark:text-white">Where</span>
            <input value={form.location} onChange={set('location')} maxLength={200} className="input mt-1 w-full" />
          </label>
        )}
        {event.format !== 'in-person' && (
          <label className="block">
            <span className="text-sm font-medium text-slate-900 dark:text-white">Link to join</span>
            <input type="url" value={form.link} onChange={set('link')} placeholder="https://" className="input mt-1 w-full" />
            <span className="mt-1 block text-xs text-slate-500">Only people who have registered see this.</span>
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-900 dark:text-white">Places (blank for no limit)</span>
            <input
              type="number"
              min={Math.max(1, event.attendees)}
              value={form.maxAttendees}
              onChange={set('maxAttendees')}
              className="input mt-1 w-full"
            />
            {event.attendees > 0 && (
              <span className="mt-1 block text-xs text-slate-500">
                {event.attendees} already registered, so it cannot go below that.
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-900 dark:text-white">Price in AUD (0 is free)</span>
            <input type="number" min={0} value={form.price} onChange={set('price')} className="input mt-1 w-full" />
            <span className="mt-1 block text-xs text-slate-500">
              ATHENA does not take payment for events. If you charge, people pay you directly.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-outline px-4 py-2" disabled={save.isPending}>
            Keep it as it is
          </button>
          <button type="submit" className="btn-primary px-4 py-2" disabled={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default EditHostedEventDialog;

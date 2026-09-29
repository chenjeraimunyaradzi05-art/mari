'use client';

/**
 * Put an event she has registered for into her own calendar.
 *
 * Registering used to be the end of it: nothing put the event anywhere she
 * would see it again, so a workshop three weeks out lived only in her memory
 * of a card she once clicked. This downloads the event as a calendar file
 * from GET /api/events/:id/calendar.ics, which any calendar app opens.
 *
 * There are two versions on purpose. A calendar is often synced to an account
 * or a phone that somebody else can see, and "Book club, 14 Such Street,
 * 7pm" in a shared calendar says where she will be and when. The discreet
 * file says "Appointment" and nothing else, and the details stay here.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarPlus, EyeOff, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

/** A Blob's text, by FileReader where Blob.text is missing (Safari before 14). */
function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** The server's words, read out of a response that came back as a file. */
async function messageFrom(error: unknown): Promise<string> {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await blobText(data)) as { message?: string; error?: string };
      return parsed.message || parsed.error || '';
    } catch {
      return '';
    }
  }
  const payload = data as { message?: string; error?: string } | undefined;
  return payload?.message || payload?.error || '';
}

export function AddToCalendar({ eventId, align = 'end' }: { eventId: string; align?: 'start' | 'end' }) {
  const [busy, setBusy] = useState<'full' | 'discreet' | null>(null);

  const download = async (discreet: boolean) => {
    setBusy(discreet ? 'discreet' : 'full');
    try {
      const response = await api.get(`/events/${eventId}/calendar.ics`, {
        params: { discreet: discreet ? '1' : '0' },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data as Blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = discreet ? 'appointment.ics' : 'event.ics';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Revoked a moment later, not at once: some browsers start the download
      // after the click handler returns, and a revoked address saves nothing.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      toast.error((await messageFrom(error)) || 'The calendar file did not download. Try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${align === 'end' ? 'items-end text-right' : 'items-start text-left'}`}>
      <div className={`flex flex-wrap gap-2 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
        <button
          type="button"
          onClick={() => void download(false)}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline disabled:opacity-60"
        >
          {busy === 'full' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
          Add to calendar
        </button>
        <button
          type="button"
          onClick={() => void download(true)}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:underline disabled:opacity-60 dark:text-slate-300"
        >
          {busy === 'discreet' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
          Add discreetly
        </button>
      </div>
      <span className="max-w-[18rem] text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        Discreetly means the entry says only &ldquo;Appointment&rdquo;, with no name or place, for a calendar someone else can see.
      </span>
    </div>
  );
}

'use client';

/**
 * Booking an hour of someone's time.
 *
 * The blueprint's skills marketplace sells two things: fixed-price packages,
 * which the order modal handles, and consultations by the hour, which had no
 * screen at all. A listing with an hourly rate and a minimum now takes a time
 * and a length here, and the price is worked out the way the server does it,
 * so nobody is surprised by the total.
 */

import { useMemo, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { SkillService, formatAud, providerName } from './types';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: SkillService;
  onBook: (data: { scheduledAt: string; durationMinutes: number; clientNotes?: string }) => Promise<void>;
}

const DURATIONS = [30, 60, 90, 120, 180, 240];

/** The soonest sensible slot: tomorrow morning, in the member's own timezone. */
function defaultSlot(): { date: string; time: string } {
  const d = new Date(Date.now() + 86400000);
  return { date: d.toISOString().slice(0, 10), time: '10:00' };
}

export function BookingModal({ isOpen, onClose, service, onBook }: BookingModalProps) {
  const slot = useMemo(defaultSlot, []);
  const [date, setDate] = useState(slot.date);
  const [time, setTime] = useState(slot.time);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [clientNotes, setClientNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const minimumHours = service.minimumHours && service.minimumHours > 1 ? service.minimumHours : 1;
  const hours = Math.max(minimumHours, durationMinutes / 60);
  const total = Math.round((service.hourlyRate ?? 0) * hours);
  const billedAboveAsked = hours > durationMinutes / 60;
  const scheduledAt = date && time ? new Date(`${date}T${time}`) : null;
  const inThePast = scheduledAt !== null && scheduledAt.getTime() < Date.now();

  const submit = async () => {
    if (!scheduledAt) {
      setError('Pick a date and a time.');
      return;
    }
    if (inThePast) {
      setError('That time has passed. Pick a later one.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onBook({ scheduledAt: scheduledAt.toISOString(), durationMinutes, clientNotes: clientNotes.trim() || undefined });
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message;
      setError(message ?? 'The booking could not be made. Try another time.');
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Book ${providerName(service)}`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {formatAud(service.hourlyRate ?? 0)} an hour
          {minimumHours > 1 ? `, ${minimumHours} hours minimum` : ''}. The time is in your own timezone.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Date</span>
            <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="input w-full text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Start</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input w-full text-sm" />
          </label>
        </div>

        <fieldset>
          <legend className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">How long</legend>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDurationMinutes(d)}
                aria-pressed={durationMinutes === d}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${durationMinutes === d ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
              >
                {d < 60 ? `${d} min` : `${d / 60} hr`}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">What you want out of it</span>
          <textarea
            value={clientNotes}
            onChange={(e) => setClientNotes(e.target.value)}
            rows={3}
            placeholder="I have a pitch on the 14th and want someone to pull it apart first."
            className="input w-full text-sm"
          />
        </label>

        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-300">{hours} hour{hours === 1 ? '' : 's'} at {formatAud(service.hourlyRate ?? 0)}</span>
            <span className="text-lg font-semibold text-slate-900 dark:text-white">{formatAud(total)}</span>
          </div>
          {billedAboveAsked && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              The {minimumHours}-hour minimum applies, so a shorter session is still billed at {hours} hours.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={busy || inThePast}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
            {busy ? 'Requesting…' : 'Request this time'}
          </Button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The seller confirms the time before anything is owed. You will see it under your bookings either way.
        </p>
      </div>
    </Modal>
  );
}

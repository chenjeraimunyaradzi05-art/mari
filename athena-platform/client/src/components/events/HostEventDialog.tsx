'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { eventHostApi, mediaApi } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Host an event. Title, what it is, when, where (a link, a place, or both),
 * an optional cover image, capacity and price. The host details come from the
 * member's profile on the server.
 */
interface HostEventDialogProps {
  open: boolean;
  onClose: () => void;
}

const TYPES = [
  { value: 'webinar', label: 'Webinar' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'networking', label: 'Networking' },
  { value: 'conference', label: 'Conference' },
  { value: 'meetup', label: 'Meetup' },
] as const;

const FORMATS = [
  { value: 'virtual', label: 'Online' },
  { value: 'in-person', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' },
] as const;

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export function HostEventDialog({ open, onClose }: HostEventDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]['value']>('webinar');
  const [format, setFormat] = useState<(typeof FORMATS)[number]['value']>('virtual');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [link, setLink] = useState('');
  const [location, setLocation] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [maxAttendees, setMaxAttendees] = useState('');
  const [price, setPrice] = useState('0');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const pickImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const res = await mediaApi.upload('cover', file);
        setImage((res.data?.data?.url as string) ?? null);
      } catch (err) {
        toast.error(errorMessage(err, 'Could not upload the image'));
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !description.trim() || !date) {
      setError('Give the event a title, a description and a date.');
      return;
    }
    setSaving(true);
    try {
      await eventHostApi.create({
        title: title.trim(),
        description: description.trim(),
        type,
        format,
        date: new Date(`${date}T${startTime}:00`).toISOString(),
        startTime,
        endTime,
        link: link.trim() || undefined,
        location: location.trim() || undefined,
        image: image ?? undefined,
        maxAttendees: maxAttendees ? Number(maxAttendees) : null,
        price: Number(price) || 0,
        tags: tags.split(/[\s,]+/).filter(Boolean),
      });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Your event is listed');
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not create the event'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Host an event">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Host an event</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Title" className="input w-full" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
            rows={4}
            placeholder="What is it, who is it for, what will people leave with?"
            className="input w-full"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-500">
              Kind
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="input mt-1 w-full">
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Format
              <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="input mt-1 w-full">
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-slate-500">
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1 w-full" />
            </label>
            <label className="text-xs text-slate-500">
              Starts
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input mt-1 w-full" />
            </label>
            <label className="text-xs text-slate-500">
              Ends
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input mt-1 w-full" />
            </label>
          </div>
          {format !== 'in-person' && (
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link to join (https://...)" className="input w-full" />
          )}
          {format !== 'virtual' && (
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder="Where (venue, suburb)" className="input w-full" />
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-500">
              Capacity (optional)
              <input type="number" min={1} value={maxAttendees} onChange={(e) => setMaxAttendees(e.target.value)} className="input mt-1 w-full" />
            </label>
            <label className="text-xs text-slate-500">
              Price in AUD (0 is free)
              <input type="number" min={0} step={1} value={price} onChange={(e) => setPrice(e.target.value)} className="input mt-1 w-full" />
            </label>
          </div>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, e.g. leadership, brisbane" className="input w-full" />
          <div className="flex items-center gap-3">
            <button type="button" onClick={pickImage} disabled={uploading} className={cn('btn-outline px-3 py-1.5 text-sm', uploading && 'opacity-60')}>
              {uploading ? 'Uploading...' : image ? 'Change cover image' : 'Add a cover image'}
            </button>
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-10 w-16 rounded object-cover" />
            )}
          </div>
        </div>

        {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-outline px-4 py-2 text-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving || uploading} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            List the event
          </button>
        </div>
      </form>
    </div>
  );
}

export default HostEventDialog;

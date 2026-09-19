'use client';

/**
 * Editing, hiding and deleting a reel you published.
 *
 * PATCH /api/video/:id and DELETE /api/video/:id have checked authorship all
 * along; nothing in the web app called them, so a typo in a caption, the
 * wrong tags, or a reel a member regretted was permanent. This sheet is the
 * one place both the profile grid and the creator studio open to change that.
 *
 * Hiding sets status HIDDEN, which the feed and every public read treat as
 * absent while the author still sees it; showing it again sets PUBLISHED.
 * A reel that is still PROCESSING is left to the pipeline, and one the
 * moderation team REMOVED cannot be republished from here.
 */

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { videoApi } from '@/lib/api-extensions';
import { apiMessage } from '@/lib/strategy-api';

export type ReelStatus = 'PROCESSING' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED';

/** The fields of a Video row the sheet reads; the rest of the row may come along. */
export interface ManagedReel {
  id: string;
  title?: string | null;
  description?: string | null;
  hashtags?: string[] | null;
  status?: ReelStatus | string | null;
  thumbnailUrl?: string | null;
}

/** What a status means to its author, in a word. */
export const REEL_STATUS_LABEL: Record<string, string> = {
  PROCESSING: 'Processing',
  PUBLISHED: 'Live',
  HIDDEN: 'Hidden',
  REMOVED: 'Removed',
};

/** "#interviews, salary leadership" becomes ['interviews', 'salary', 'leadership']. */
export function parseReelTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#+/, '').toLowerCase().trim())
        .filter((tag) => tag.length >= 2)
    )
  ).slice(0, 20);
}

function sameTags(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((tag, index) => tag === sorted[index]);
}

type Changes = Parameters<typeof videoApi.update>[1];

interface ManageReelSheetProps {
  /** The reel being managed; null closes the sheet. */
  reel: ManagedReel | null;
  onClose: () => void;
  /** After a save or a visibility change, with the fields that changed applied. */
  onUpdated?: (reel: ManagedReel) => void;
  onDeleted?: (id: string) => void;
}

export function ManageReelSheet({ reel, onClose, onUpdated, onDeleted }: ManageReelSheetProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<string>('PUBLISHED');
  const [busy, setBusy] = useState<'save' | 'visibility' | 'delete' | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A different reel (or the same one reopened) starts from what is saved.
  useEffect(() => {
    setTitle(reel?.title ?? '');
    setDescription(reel?.description ?? '');
    setTags((reel?.hashtags ?? []).join(', '));
    setStatus(reel?.status ?? 'PUBLISHED');
    setBusy(null);
    setConfirmingDelete(false);
    setError(null);
  }, [reel]);

  const parsedTags = parseReelTags(tags);

  const save = async () => {
    if (!reel) return;
    const changes: Changes = {};
    const nextTitle = title.trim();
    const nextDescription = description.trim();
    if (nextTitle !== (reel.title ?? '').trim()) changes.title = nextTitle;
    if (nextDescription !== (reel.description ?? '').trim()) changes.description = nextDescription;
    if (!sameTags(parsedTags, reel.hashtags ?? [])) changes.hashtags = parsedTags;

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setBusy('save');
    setError(null);
    try {
      const res = await videoApi.update(reel.id, changes);
      toast.success('Reel updated.');
      onUpdated?.({ ...reel, ...changes, ...(res.data?.data ?? {}) });
      onClose();
    } catch (err) {
      setError(apiMessage(err, 'The reel could not be updated. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  const setVisibility = async (next: 'HIDDEN' | 'PUBLISHED') => {
    if (!reel) return;
    setBusy('visibility');
    setError(null);
    try {
      const res = await videoApi.update(reel.id, { status: next });
      setStatus(next);
      toast.success(next === 'HIDDEN' ? 'Hidden. Only you can see it now.' : 'Back in the feed.');
      onUpdated?.({ ...reel, status: next, ...(res.data?.data ?? {}) });
    } catch (err) {
      setError(apiMessage(err, 'The change did not go through. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!reel) return;
    setBusy('delete');
    setError(null);
    try {
      await videoApi.delete(reel.id);
      toast.success('Reel deleted.');
      onDeleted?.(reel.id);
      onClose();
    } catch (err) {
      setError(apiMessage(err, 'The reel could not be deleted. Try again.'));
      setBusy(null);
    }
  };

  const canToggle = status === 'PUBLISHED' || status === 'HIDDEN';
  const fieldClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

  return (
    <Modal
      isOpen={reel !== null}
      onClose={onClose}
      title="Your reel"
      description="Change the words, take it out of the feed for a while, or let it go."
    >
      <ModalContent className="space-y-4">
        {status === 'REMOVED' && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            This reel was taken down by the moderation team, so it cannot go back in the feed from here.
          </p>
        )}

        <div>
          <label htmlFor="manage-reel-title" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Title
          </label>
          <input
            id="manage-reel-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            disabled={busy !== null}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="manage-reel-caption" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Caption
          </label>
          <textarea
            id="manage-reel-caption"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            disabled={busy !== null}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="manage-reel-tags" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Tags
          </label>
          <input
            id="manage-reel-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="interviews, salary, leadership"
            disabled={busy !== null}
            className={fieldClass}
          />
          {parsedTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parsedTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {canToggle && (
          <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {status === 'HIDDEN' ? 'Hidden from the feed' : 'In the feed'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {status === 'HIDDEN'
                  ? 'Only you can see it. Show it again whenever you like.'
                  : 'Hide it and only you can see it. Nothing is lost.'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-shrink-0 gap-1.5"
              onClick={() => void setVisibility(status === 'HIDDEN' ? 'PUBLISHED' : 'HIDDEN')}
              disabled={busy !== null}
            >
              {busy === 'visibility' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : status === 'HIDDEN' ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              {status === 'HIDDEN' ? 'Show again' : 'Hide from feed'}
            </Button>
          </div>
        )}

        {status === 'PROCESSING' && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Still being made web-ready. You can hide it or show it once it is live.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </ModalContent>

      <ModalFooter className="justify-between">
        {confirmingDelete ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">Delete it for good? Its likes and comments go with it.</p>
            <div className="flex flex-shrink-0 gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)} disabled={busy !== null}>
                Keep it
              </Button>
              <Button type="button" variant="destructive" onClick={() => void remove()} disabled={busy !== null}>
                {busy === 'delete' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {busy === 'delete' ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy !== null}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={busy !== null}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void save()} disabled={busy !== null}>
                {busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {busy === 'save' ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}

export default ManageReelSheet;

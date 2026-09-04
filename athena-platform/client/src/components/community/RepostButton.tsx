'use client';

/**
 * Repost, undo a repost, or quote. The count is the original's; when this
 * button sits on a repost it acts on the post underneath.
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MessageSquareQuote, Repeat2 } from 'lucide-react';
import { postApi } from '@/lib/api';
import { serializeMentions, type MentionPick } from '@/lib/mentions';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { MentionTextarea } from './MentionTextarea';
import { RepostEmbed, type RepostOriginal } from './RepostEmbed';

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

type Props = {
  /** The post the repost should point at: the original when this is a repost. */
  targetId: string;
  original: RepostOriginal;
  isReposted?: boolean;
  repostCount?: number;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
};

export function RepostButton({ targetId, original, isReposted = false, repostCount = 0, disabled, compact, className }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reposted, setReposted] = useState(isReposted);
  const [count, setCount] = useState(repostCount);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quote, setQuote] = useState('');
  const [picks, setPicks] = useState<MentionPick[]>([]);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setReposted(isReposted), [isReposted, targetId]);
  useEffect(() => setCount(repostCount), [repostCount, targetId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['user-posts'] });
    queryClient.invalidateQueries({ queryKey: ['post', targetId] });
  };

  const toggleRepost = async () => {
    setOpen(false);
    if (disabled) {
      toast.error('Sign in to repost');
      return;
    }
    const next = !reposted;
    setReposted(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      await (next ? postApi.repost(targetId) : postApi.unrepost(targetId));
      toast.success(next ? 'Reposted to your profile' : 'Repost removed');
      refresh();
    } catch (error) {
      setReposted(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error(errorMessage(error) || 'Could not update the repost');
    }
  };

  const submitQuote = async () => {
    const content = serializeMentions(quote.trim(), picks);
    if (!content) return;
    setBusy(true);
    try {
      await postApi.repost(targetId, content);
      setCount((c) => c + 1);
      setQuoteOpen(false);
      setQuote('');
      setPicks([]);
      toast.success('Quote posted');
      refresh();
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not post the quote');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('relative', className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          if (disabled) {
            toast.error('Sign in to repost');
            return;
          }
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-pressed={reposted}
        aria-label={reposted ? 'Reposted' : 'Repost'}
        className={cn(
          'flex items-center gap-2 rounded-md transition-colors text-sm font-medium',
          compact ? 'p-0' : 'px-3 py-3 hover:bg-slate-100',
          reposted ? 'text-emerald-600' : 'text-slate-500'
        )}
      >
        <Repeat2 className={compact ? 'h-6 w-6 hover:opacity-60 lg:h-5 lg:w-5' : 'h-5 w-5'} />
        {!compact && <span>{reposted ? 'Reposted' : 'Repost'}</span>}
        {count > 0 && <span className={cn('text-xs', compact ? 'text-slate-500' : 'opacity-70')}>{formatCount(count)}</span>}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-1 min-w-[180px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void toggleRepost()}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Repeat2 className="h-4 w-4" /> {reposted ? 'Undo repost' : 'Repost'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setQuoteOpen(true);
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <MessageSquareQuote className="h-4 w-4" /> Quote
          </button>
        </div>
      )}

      <Modal isOpen={quoteOpen} onClose={() => !busy && setQuoteOpen(false)} title="Quote this post" size="md">
        <div className="space-y-3">
          <MentionTextarea
            value={quote}
            onChange={setQuote}
            picks={picks}
            onPicksChange={setPicks}
            rows={4}
            maxLength={5000}
            placeholder="Add your thoughts... @ to mention someone"
            onSubmitShortcut={() => void submitQuote()}
            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <RepostEmbed original={original} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setQuoteOpen(false)} disabled={busy} className="btn-outline px-3 py-1.5 text-sm">
              Cancel
            </button>
            <button type="button" onClick={() => void submitQuote()} disabled={busy || !quote.trim()} className="btn-primary px-3 py-1.5 text-sm">
              {busy ? 'Posting...' : 'Post quote'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

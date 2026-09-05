'use client';

/**
 * Send a post to someone in a message. Recent conversations come first; any
 * other member can be found by name. The message carries an optional note
 * and the post's link, which the chat renders as a link.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, Loader2, Search, Send } from 'lucide-react';
import { mentionApi, messageApi } from '@/lib/api';
import { useAuthStore, useConversations } from '@/lib/hooks';
import { Modal } from '@/components/ui/modal';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type Person = { id: string; name: string; avatar: string | null; headline?: string | null };

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

export function SharePostDialog({
  postId,
  excerpt,
  open,
  onClose,
  link,
  title = 'Send in a message',
}: {
  postId: string;
  excerpt?: string;
  open: boolean;
  onClose: () => void;
  /** What to send; defaults to the post's page. A reel passes its own link. */
  link?: string;
  title?: string;
}) {
  const { user } = useAuthStore();
  const { data: conversations } = useConversations();
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<Person[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setChosen([]);
      setNote('');
      setSearch('');
    }
  }, [open]);

  // The other person in each recent one-to-one thread.
  const recent = useMemo<Person[]>(() => {
    const list = Array.isArray(conversations) ? conversations : [];
    const people: Person[] = [];
    for (const conversation of list as Array<{ participants?: Array<{ id: string; name: string; avatar?: string | null }> }>) {
      const other = (conversation.participants ?? []).find((p) => p.id !== user?.id);
      if (other && !people.some((p) => p.id === other.id)) people.push({ id: other.id, name: other.name, avatar: other.avatar ?? null });
    }
    return people.slice(0, 8);
  }, [conversations, user?.id]);

  const { data: found = [], isFetching } = useQuery({
    queryKey: ['share-search', search],
    queryFn: () => mentionApi.suggest(search.trim()),
    enabled: open && search.trim().length > 0,
    select: (response) =>
      (Array.isArray(response.data?.data) ? response.data.data : []).filter((p: Person) => p.id !== user?.id) as Person[],
  });

  const candidates = search.trim() ? found : recent;

  const toggle = (person: Person) =>
    setChosen((current) => (current.some((p) => p.id === person.id) ? current.filter((p) => p.id !== person.id) : [...current, person]));

  const send = async () => {
    if (chosen.length === 0) return;
    setSending(true);
    const target = link ?? `${window.location.origin}/posts/${postId}`;
    const content = `${note.trim() ? `${note.trim()}\n` : ''}${target}`;
    let sent = 0;
    let failure: string | null = null;
    for (const person of chosen) {
      try {
        const conversation = await messageApi.startConversation(person.id);
        const conversationId = conversation.data?.data?.id ?? conversation.data?.id;
        if (!conversationId) throw new Error('No conversation');
        await messageApi.send(conversationId, content);
        sent += 1;
      } catch (error) {
        failure = errorMessage(error) || `Could not send to ${person.name}`;
      }
    }
    setSending(false);
    if (sent > 0) toast.success(sent === 1 ? `Sent to ${chosen[0].name}` : `Sent to ${sent} people`);
    if (failure) toast.error(failure);
    if (sent > 0) onClose();
  };

  return (
    <Modal isOpen={open} onClose={() => !sending && onClose()} title={title} size="sm">
      <div className="space-y-3">
        {excerpt && <p className="line-clamp-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{excerpt}</p>}

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <ul className="max-h-56 space-y-1 overflow-y-auto" role="listbox" aria-label="People" aria-multiselectable>
          {isFetching && candidates.length === 0 && (
            <li className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </li>
          )}
          {!isFetching && candidates.length === 0 && (
            <li className="py-4 text-center text-xs text-slate-500">{search.trim() ? 'Nobody by that name.' : 'Search for someone to send this to.'}</li>
          )}
          {candidates.map((person) => {
            const on = chosen.some((p) => p.id === person.id);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(person)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800',
                    on && 'bg-rose-50 dark:bg-rose-900/20'
                  )}
                >
                  <Avatar src={person.avatar || undefined} alt={person.name} fallback={person.name.slice(0, 2).toUpperCase()} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900 dark:text-white">{person.name}</span>
                    {person.headline && <span className="block truncate text-xs text-slate-500">{person.headline}</span>}
                  </span>
                  {on && <Check className="h-4 w-4 text-rose-600" />}
                </button>
              </li>
            );
          })}
        </ul>

        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={300}
          placeholder="Add a note (optional)"
          aria-label="Note"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{chosen.length > 0 ? `${chosen.length} chosen` : ''}</span>
          <button type="button" onClick={() => void send()} disabled={sending || chosen.length === 0} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
          </button>
        </div>
      </div>
    </Modal>
  );
}

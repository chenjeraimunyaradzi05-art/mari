'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Hash } from 'lucide-react';
import { mentionApi, topicApi } from '@/lib/api';
import { activeHashtagQuery, activeMentionQuery, type MentionPick } from '@/lib/mentions';
import { cn } from '@/lib/utils';

/**
 * A textarea (or single-line input) with @ and # autocomplete. Typing "@me"
 * opens a list of members; picking one inserts "@Mei Chen " and records the
 * pick, so the caller can serialise the mention on submit. Typing "#lea"
 * offers topics in use, busiest first, and inserts "#leadership ".
 */
interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  picks: MentionPick[];
  onPicksChange: (picks: MentionPick[]) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  singleLine?: boolean;
  maxLength?: number;
  disabled?: boolean;
  id?: string;
  onSubmitShortcut?: () => void;
}

type MemberSuggestion = { kind: 'member'; id: string; name: string; avatar: string | null; headline: string | null };
type TopicSuggestion = { kind: 'topic'; id: string; tag: string; count: number };
type Suggestion = MemberSuggestion | TopicSuggestion;

type Query = { kind: 'member' | 'topic'; query: string; start: number };

function activeQuery(text: string, caret: number): Query | null {
  const mention = activeMentionQuery(text, caret);
  if (mention) return { kind: 'member', ...mention };
  const topic = activeHashtagQuery(text, caret);
  if (topic) return { kind: 'topic', ...topic };
  return null;
}

export function MentionTextarea({
  value,
  onChange,
  picks,
  onPicksChange,
  placeholder,
  className,
  rows = 4,
  singleLine = false,
  maxLength,
  disabled,
  id,
  onSubmitShortcut,
}: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [query, setQuery] = useState<Query | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);

  const refresh = useCallback((text: string, caret: number) => {
    setQuery(activeQuery(text, caret));
  }, []);

  useEffect(() => {
    // Members need a letter to search by; topics can be browsed from "#".
    if (!query || (query.kind === 'member' && query.query.length < 1)) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const request =
        query.kind === 'member'
          ? mentionApi.suggest(query.query).then((res) =>
              (Array.isArray(res.data?.data) ? res.data.data : []).map(
                (m: Omit<MemberSuggestion, 'kind'>): Suggestion => ({ kind: 'member', ...m })
              )
            )
          : topicApi.suggest(query.query).then((res) =>
              (Array.isArray(res.data?.data) ? res.data.data : []).map(
                (t: { tag: string; count: number }): Suggestion => ({ kind: 'topic', id: `#${t.tag}`, tag: t.tag, count: t.count })
              )
            );
      request
        .then((list) => {
          if (cancelled) return;
          setSuggestions(list);
          setActive(0);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const pick = (suggestion: Suggestion) => {
    if (!query) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, query.start);
    const after = value.slice(caret);
    const inserted = suggestion.kind === 'member' ? `@${suggestion.name} ` : `#${suggestion.tag} `;
    const next = `${before}${inserted}${after}`;
    onChange(next);
    if (suggestion.kind === 'member' && !picks.some((p) => p.id === suggestion.id)) {
      onPicksChange([...picks, { id: suggestion.id, name: suggestion.name }]);
    }
    setQuery(null);
    setSuggestions([]);
    requestAnimationFrame(() => {
      const position = before.length + inserted.length;
      ref.current?.setSelectionRange(position, position);
      ref.current?.focus();
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((i) => (i + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pick(suggestions[active]);
        return;
      }
      if (event.key === 'Escape') {
        setSuggestions([]);
        setQuery(null);
        return;
      }
    }
    if (onSubmitShortcut && event.key === 'Enter' && (singleLine || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmitShortcut();
    }
  };

  const sharedProps = {
    ref: ref as never,
    id,
    value,
    placeholder,
    maxLength,
    disabled,
    onKeyDown,
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      onChange(event.target.value);
      refresh(event.target.value, event.target.selectionStart ?? event.target.value.length);
    },
    onClick: (event: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      const target = event.currentTarget;
      refresh(target.value, target.selectionStart ?? target.value.length);
    },
    'aria-autocomplete': 'list' as const,
    'aria-expanded': suggestions.length > 0,
  };

  return (
    <div className="relative">
      {singleLine ? <input type="text" {...sharedProps} className={className} /> : <textarea rows={rows} {...sharedProps} className={className} />}

      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label={query?.kind === 'topic' ? 'Topics' : 'Members'}
          className="absolute left-0 z-20 mt-1 max-h-60 w-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(suggestion)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                  index === active ? 'bg-rose-50 dark:bg-rose-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                {suggestion.kind === 'topic' ? (
                  <>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      <Hash className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">#{suggestion.tag}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {suggestion.count > 0 ? `${suggestion.count} ${suggestion.count === 1 ? 'post' : 'posts'} this month` : 'New topic'}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    {suggestion.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element -- media CDN
                      <img src={suggestion.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {suggestion.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900 dark:text-white">{suggestion.name}</span>
                      {suggestion.headline && <span className="block truncate text-xs text-slate-500">{suggestion.headline}</span>}
                    </span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MentionTextarea;

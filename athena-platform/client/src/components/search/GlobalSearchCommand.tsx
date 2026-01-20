'use client';

import { useEffect, useMemo, useState, type ElementType } from 'react';
import { Dialog } from '@headlessui/react';
import { Search, Briefcase, Users, GraduationCap, PlayCircle, Sparkles, Building2, FileText, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { searchApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface GlobalSearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ResultType = 'user' | 'job' | 'course' | 'video' | 'mentor' | 'post' | 'company' | 'unknown';

interface ResultItem {
  id: string;
  type: ResultType;
  title: string;
  subtitle?: string;
  url: string;
}

const typeIcons: Record<ResultType, ElementType> = {
  user: Users,
  job: Briefcase,
  course: GraduationCap,
  video: PlayCircle,
  mentor: Sparkles,
  post: FileText,
  company: Building2,
  unknown: Search,
};

const mapResult = (result: any): ResultItem => {
  const type = (result.type as ResultType) || 'unknown';
  const metadata = result.metadata || {};

  const title = result.title || metadata?.name || result.content || 'Result';
  const subtitle = metadata?.company?.name || metadata?.headline || metadata?.location || result.highlight;

  const urlMap: Record<ResultType, string> = {
    user: `/dashboard/profile/${result.id}`,
    job: `/dashboard/jobs/${result.id}`,
    course: `/dashboard/learn/${result.id}`,
    video: `/dashboard/community?video=${result.id}`,
    mentor: `/dashboard/mentors/${result.id}`,
    post: `/dashboard/community?post=${result.id}`,
    company: '/dashboard/companies',
    unknown: '/dashboard/search',
  };

  return {
    id: result.id,
    type,
    title,
    subtitle,
    url: urlMap[type] || '/dashboard/search',
  };
};

export default function GlobalSearchCommand({ open, onOpenChange }: GlobalSearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isCmdK) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    const timeout = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [searchResponse, suggestionResponse] = await Promise.all([
          searchApi.unified({ q: query, type: 'all', limit: 8 }),
          searchApi.suggestions(query),
        ]);

        const rawResults = searchResponse.data?.data?.results || [];
        const mapped = rawResults.map(mapResult);
        setResults(mapped);
        setSuggestions(suggestionResponse.data?.data || []);
      } catch (error) {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query, open]);

  const grouped = useMemo(() => {
    return results.reduce((acc: Record<string, ResultItem[]>, item) => {
      const key = item.type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [results]);

  const handleSelect = (item: ResultItem) => {
    onOpenChange(false);
    setQuery('');
    router.push(item.url);
  };

  return (
    <Dialog open={open} onClose={onOpenChange} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center p-4 sm:p-6">
        <Dialog.Panel className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800">
          <div className="flex items-center border-b border-gray-200 dark:border-gray-800 px-4 py-3">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent px-3 text-sm text-gray-900 dark:text-white focus:outline-none"
              placeholder="Search people, jobs, courses, mentors, videos..."
              autoFocus
            />
            <button
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Close search"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4">
            {isLoading && (
              <div className="py-8 text-center text-sm text-gray-500">Searching...</div>
            )}

            {!isLoading && query.trim().length === 0 && (
              <div className="py-6 text-center text-sm text-gray-500">
                Type to search across Athena.
              </div>
            )}

            {!isLoading && query.trim().length > 0 && results.length === 0 && (
              <div className="py-6 text-center text-sm text-gray-500">No results found.</div>
            )}

            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-4">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">
                  {group}
                </p>
                <div className="space-y-2">
                  {items.map((item) => {
                    const Icon = typeIcons[item.type] || Search;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800',
                          'focus:outline-none focus:ring-2 focus:ring-primary-500'
                        )}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600">
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-gray-900 dark:text-white truncate">{item.title}</span>
                          {item.subtitle && (
                            <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                              {item.subtitle}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {suggestions.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setQuery(suggestion)}
                      className="px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

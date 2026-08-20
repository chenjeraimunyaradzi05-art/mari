'use client';

import { useEffect, useMemo, useState, type ElementType } from 'react';
import { Dialog } from '@headlessui/react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Command,
  Compass,
  DollarSign,
  FileText,
  GraduationCap,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
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

const quickLaunches = [
  {
    label: 'Opportunity Radar',
    description: 'Roles, companies, mentors, and market signals',
    href: '/dashboard/ai/opportunity-radar',
    icon: Compass,
  },
  {
    label: 'AI Coach',
    description: 'Resume, interview, strategy, and confidence help',
    href: '/dashboard/ai/chat',
    icon: Sparkles,
  },
  {
    label: 'Finance OS',
    description: 'Money, tax, accounting, savings, and inventory',
    href: '/dashboard/finance',
    icon: DollarSign,
  },
  {
    label: 'Mentor Network',
    description: 'Book guidance from trusted operators',
    href: '/dashboard/mentors',
    icon: Users,
  },
  {
    label: 'Learning Paths',
    description: 'Courses, providers, cohorts, and applications',
    href: '/dashboard/learn',
    icon: GraduationCap,
  },
  {
    label: 'Trust & Safety',
    description: 'Privacy, reports, verification, and AI trust',
    href: '/dashboard/ai/trust',
    icon: ShieldCheck,
  },
];

const popularSearches = [
  'remote product roles',
  'women in AI mentors',
  'grant-ready business plan',
  'salary negotiation',
  'cybersecurity course',
];

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
        setSuggestions([]);
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

  const closeAndNavigate = (url: string) => {
    onOpenChange(false);
    setQuery('');
    router.push(url);
  };

  const submitSearch = () => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;
    closeAndNavigate(`/dashboard/search?q=${encodeURIComponent(cleanQuery)}`);
  };

  const handleSelect = (item: ResultItem) => {
    closeAndNavigate(item.url);
  };

  return (
    <Dialog open={open} onClose={onOpenChange} className="relative z-50">
      <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-start justify-center p-4 sm:p-6">
        <Dialog.Panel className="mt-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-rose-200/70 bg-white shadow-[0_30px_90px_-30px_rgba(244,63,94,0.55)] dark:border-rose-400/20 dark:bg-slate-950">
          <div className="border-b border-slate-200 bg-gradient-to-r from-rose-50 via-white to-cyan-50 px-4 py-3 dark:border-slate-800 dark:from-rose-950/30 dark:via-slate-950 dark:to-cyan-950/20">
            <Dialog.Title className="sr-only">Search ATHENA</Dialog.Title>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <Command className="h-3.5 w-3.5" />
                ATHENA Command
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100 dark:border-slate-800 dark:bg-slate-900 dark:focus-within:border-primary-400/50 dark:focus-within:ring-primary-400/10">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitSearch();
                  }
                }}
                className="w-full bg-transparent px-3 text-sm text-slate-900 outline-none dark:text-white"
                placeholder="Search people, jobs, courses, mentors, videos..."
                autoFocus
              />
              <button
                type="button"
                onClick={submitSearch}
                disabled={!query.trim()}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-slate-950 px-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Search
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-4">
            {isLoading && (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
                ))}
              </div>
            )}

            {!isLoading && query.trim().length === 0 && (
              <div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {quickLaunches.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => closeAndNavigate(item.href)}
                      className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary-400/30"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-50 to-cyan-50 text-primary-600 dark:from-primary-400/10 dark:to-cyan-400/10 dark:text-primary-300">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-950 dark:text-white">{item.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</span>
                      </span>
                      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary-500" />
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Popular searches</p>
                  <div className="flex flex-wrap gap-2">
                    {popularSearches.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setQuery(suggestion)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary-400/30 dark:hover:bg-primary-400/10 dark:hover:text-primary-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!isLoading && query.trim().length > 0 && results.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
                <Search className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">No instant matches yet.</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Run a full search across the platform for &ldquo;{query.trim()}&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={submitSearch}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  Open full results
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-4">
                <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
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
                          'w-full flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800',
                          'focus:outline-none focus:ring-2 focus:ring-primary-500'
                        )}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600">
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-slate-900 dark:text-white truncate">{item.title}</span>
                          {item.subtitle && (
                            <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
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
                <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setQuery(suggestion)}
                      className="px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
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

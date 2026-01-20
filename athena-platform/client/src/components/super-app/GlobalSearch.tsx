'use client';

/**
 * Global Search / Command Palette
 * Unified search with keyboard navigation (Cmd+K style)
 * Phase 3: Web Client - Super App Core
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/stores/ui.store';
import { useSearchStore, type SearchCategory, type SearchResult } from '@/lib/stores/search.store';
import {
  Search,
  X,
  User,
  Briefcase,
  FileText,
  GraduationCap,
  Users,
  ArrowRight,
  Clock,
  Trash2,
  Loader2,
  Hash,
  TrendingUp,
  Command,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useDebounce } from '@/lib/hooks';

// Simple visually hidden component (CSS-based, no Radix dependency)
const VisuallyHidden = ({ children }: { children: React.ReactNode }) => (
  <span className="sr-only">{children}</span>
);

const CATEGORY_CONFIG: Record<SearchCategory, { label: string; icon: React.ElementType }> = {
  all: { label: 'All', icon: Search },
  users: { label: 'People', icon: User },
  jobs: { label: 'Jobs', icon: Briefcase },
  posts: { label: 'Posts', icon: FileText },
  courses: { label: 'Courses', icon: GraduationCap },
  groups: { label: 'Groups', icon: Users },
  mentors: { label: 'Mentors', icon: User },
};

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  const { isSearchOpen, setSearchOpen } = useUIStore();
  const {
    query,
    setQuery,
    activeCategory,
    setCategory,
    results,
    setResults,
    isSearching,
    setSearching,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    selectedIndex,
    setSelectedIndex,
  } = useSearchStore();

  const debouncedQuery = useDebounce(query, 300);

  // Focus input when opened
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setSelectedIndex(-1);
    }
  }, [isSearchOpen, setQuery, setSelectedIndex]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(!isSearchOpen);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setSearchOpen]);

  // Perform search
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setResults([]);
        return;
      }

      setSearching(true);
      try {
        const response = await api.get('/api/search', {
          params: {
            q: debouncedQuery,
            type: activeCategory === 'all' ? undefined : activeCategory,
            limit: 10,
          },
        });

        const data = response.data.data || response.data;
        const mappedResults: SearchResult[] = (data.results || []).map((item: any) => ({
          id: item.id,
          type: item.type || 'posts',
          title: item.title || item.name || item.displayName || 'Untitled',
          subtitle: item.subtitle || item.headline || item.description?.slice(0, 100),
          image: item.image || item.avatar || item.thumbnail,
          url: getResultUrl(item),
          metadata: item,
        }));

        setResults(mappedResults);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setSearching(false);
      }
    };

    performSearch();
  }, [debouncedQuery, activeCategory, setResults, setSearching]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalItems = results.length + recentSearches.length;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(Math.min(selectedIndex + 1, totalItems - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(Math.max(selectedIndex - 1, -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        if (selectedIndex < results.length) {
          handleSelectResult(results[selectedIndex]);
        } else {
          const recentIndex = selectedIndex - results.length;
          const recent = recentSearches[recentIndex];
          if (recent) {
            setQuery(recent.query);
            setCategory(recent.category);
          }
        }
      }
    },
    [results, recentSearches, selectedIndex, setSelectedIndex, setQuery, setCategory]
  );

  const handleSelectResult = (result: SearchResult) => {
    addRecentSearch(query, activeCategory);
    setSearchOpen(false);
    router.push(result.url);
  };

  const getResultIcon = (type: SearchCategory) => {
    const config = CATEGORY_CONFIG[type];
    return config?.icon || FileText;
  };

  return (
    <Dialog open={isSearchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Search</DialogTitle>
        </VisuallyHidden>
        
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 border-b border-zinc-200 dark:border-zinc-800">
          <Search className="h-5 w-5 text-zinc-400" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search people, jobs, posts, courses..."
            className="flex-1 border-0 focus-visible:ring-0 text-base py-4 px-0"
          />
          {isSearching && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
          {query && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQuery('')}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <kbd className="hidden sm:flex h-6 select-none items-center gap-1 rounded border bg-zinc-100 dark:bg-zinc-800 px-2 font-mono text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
            ESC
          </kbd>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          {(Object.keys(CATEGORY_CONFIG) as SearchCategory[]).map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            const Icon = config.icon;
            return (
              <Button
                key={cat}
                variant={activeCategory === cat ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCategory(cat)}
                className="shrink-0"
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />
                {config.label}
              </Button>
            );
          })}
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[60vh] overflow-y-auto"
        >
          {/* Search Results */}
          {results.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-xs font-medium text-zinc-500 uppercase">
                Results
              </div>
              {results.map((result, index) => {
                const Icon = getResultIcon(result.type);
                const isSelected = selectedIndex === index;
                
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelectResult(result)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors',
                      isSelected && 'bg-zinc-100 dark:bg-zinc-800'
                    )}
                  >
                    {result.image ? (
                      <img
                        src={result.image}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-zinc-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.title}</p>
                      {result.subtitle && (
                        <p className="text-sm text-zinc-500 truncate">{result.subtitle}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0 capitalize">
                      {result.type}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-zinc-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 uppercase">Recent</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecentSearches}
                  className="h-6 text-xs text-zinc-500"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
              {recentSearches.map((recent, index) => {
                const isSelected = selectedIndex === results.length + index;
                
                return (
                  <button
                    key={recent.id}
                    onClick={() => {
                      setQuery(recent.query);
                      setCategory(recent.category);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors',
                      isSelected && 'bg-zinc-100 dark:bg-zinc-800'
                    )}
                  >
                    <Clock className="h-4 w-4 text-zinc-400" />
                    <span className="flex-1">{recent.query}</span>
                    <Badge variant="outline" className="capitalize text-xs">
                      {recent.category}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}

          {/* Trending */}
          {!query && recentSearches.length === 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-xs font-medium text-zinc-500 uppercase flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Trending
              </div>
              {['Remote Jobs', 'Career Change Tips', 'Tech Skills 2026', 'Leadership Courses'].map(
                (trend) => (
                  <button
                    key={trend}
                    onClick={() => setQuery(trend)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                  >
                    <Hash className="h-4 w-4 text-zinc-400" />
                    <span>{trend}</span>
                  </button>
                )
              )}
            </div>
          )}

          {/* No Results */}
          {query && !isSearching && results.length === 0 && (
            <div className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
              <p className="text-zinc-500">No results found for &quot;{query}&quot;</p>
              <p className="text-sm text-zinc-400 mt-1">Try different keywords or filters</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border bg-zinc-100 dark:bg-zinc-800">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border bg-zinc-100 dark:bg-zinc-800">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border bg-zinc-100 dark:bg-zinc-800">esc</kbd>
              Close
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" />K to search
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getResultUrl(item: any): string {
  const type = item.type || 'posts';
  switch (type) {
    case 'users':
    case 'user':
      return `/profile/${item.id}`;
    case 'jobs':
    case 'job':
      return `/jobs/${item.id}`;
    case 'posts':
    case 'post':
      return `/posts/${item.id}`;
    case 'courses':
    case 'course':
      return `/courses/${item.id}`;
    case 'groups':
    case 'group':
      return `/communities/${item.id}`;
    case 'mentors':
    case 'mentor':
      return `/mentors/${item.id}`;
    default:
      return `/${type}/${item.id}`;
  }
}

export default GlobalSearch;

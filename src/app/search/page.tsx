"use client";

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import { FEED_FILTERS } from '@/lib/feed-config';
import { Search, MapPin, Briefcase, Building2, User, Filter, Bookmark, ChevronDown, ArrowRight } from 'lucide-react';

const searchTypes = [
  { value: 'jobs', label: 'Jobs', icon: Briefcase },
  { value: 'candidates', label: 'Members', icon: User },
  { value: 'companies', label: 'Companies', icon: Building2 },
];

const seniorityOptions = [
  { value: '', label: 'Any level' },
  { value: 'entry', label: 'Entry' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'executive', label: 'Executive' },
];

type SearchState = {
  type: string;
  q: string;
  location: string;
  seniority: string;
  tag?: string;
};

type SavedSearch = SearchState & { id: string; label: string };

type SearchResponse = {
  type: string;
  results: Array<Record<string, unknown>>;
  count: number;
  error?: string;
};

const STORAGE_KEY = 'athena_saved_searches';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Search request failed');
  return res.json() as Promise<SearchResponse>;
};

const buildQuery = (state: SearchState) => {
  const params = new URLSearchParams();
  if (state.type) params.set('type', state.type);
  if (state.q) params.set('q', state.q);
  if (state.location) params.set('location', state.location);
  if (state.seniority) params.set('seniority', state.seniority);
  if (state.tag) params.set('tag', state.tag);
  return params.toString();
};

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<SearchState>({
    type: searchParams.get('type') || 'jobs',
    q: searchParams.get('q') || '',
    location: searchParams.get('location') || '',
    seniority: searchParams.get('seniority') || '',
    tag: searchParams.get('tag') || undefined,
  });

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  // const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSavedSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved searches', e);
      }
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = buildQuery(state);
    router.push(`/search?${query}`);
  };

  const saveSearch = () => {
    const newSaved: SavedSearch = {
      ...state,
      id: crypto.randomUUID(),
      label: state.q || `Search ${new Date().toLocaleDateString()}`,
    };
    const updated = [newSaved, ...savedSearches].slice(0, 5);
    setSavedSearches(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const loadSaved = (saved: SavedSearch) => {
    setState({
      type: saved.type,
      q: saved.q,
      location: saved.location,
      seniority: saved.seniority,
      tag: saved.tag,
    });
    const query = buildQuery(saved);
    router.push(`/search?${query}`);
  };

  const { data, error, isLoading } = useSWR<SearchResponse>(
    `/api/search?${buildQuery(state)}`,
    fetcher,
    { keepPreviousData: true }
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Hero Header */}
      <div className="bg-white border-b border-slate-200 pt-8 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <span className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-2 block">Advanced Search</span>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Find opportunities</h1>
              <p className="text-slate-600 mt-2 max-w-2xl">
                Search across jobs, members, and companies. Tune filters and bookmark queries.
              </p>
            </div>
            <div className="flex gap-2">
              {savedSearches.length > 0 && (
                <div className="dropdown relative group">
                  <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex items-center gap-2 hover:bg-slate-50">
                    <Bookmark className="w-4 h-4 text-purple-500" />
                    Saved Searches
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-2 hidden group-hover:block z-20">
                    {savedSearches.map(s => (
                      <button
                        key={s.id}
                        onClick={() => loadSaved(s)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 truncate"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search Form */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6">
            <form onSubmit={handleSearch} className="space-y-6">
              {/* Type Selector */}
              <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                {searchTypes.map((type) => {
                  const Icon = type.icon;
                  const isActive = state.type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setState({ ...state, type: type.value })}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
                        ${isActive 
                          ? 'bg-white text-purple-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      {type.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-5 relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={state.q}
                    onChange={(e) => setState({ ...state, q: e.target.value })}
                    placeholder="Role, skill, company..."
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                  />
                </div>
                
                <div className="md:col-span-3 relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={state.location}
                    onChange={(e) => setState({ ...state, location: e.target.value })}
                    placeholder="Location"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <select
                    value={state.seniority}
                    onChange={(e) => setState({ ...state, seniority: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all appearance-none bg-white"
                  >
                    {seniorityOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="w-full h-full bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    Search
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="max-w-7xl mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Filters */}
          <div className="hidden lg:block space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {['Remote', 'Full-time', 'Contract', 'Urgent'].map(tag => (
                      <button
                        key={tag}
                        onClick={() => setState({ ...state, tag: tag === state.tag ? undefined : tag })}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                          state.tag === tag 
                            ? 'bg-purple-50 border-purple-200 text-purple-700' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-purple-200'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">
                {isLoading ? 'Searching...' : `${data?.count || 0} results found`}
              </h2>
              <button onClick={saveSearch} className="text-sm font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1">
                <Bookmark className="w-4 h-4" />
                Save this search
              </button>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 animate-pulse h-40"></div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 text-red-600 p-6 rounded-2xl text-center">
                Failed to load results. Please try again.
              </div>
            ) : (
              <div className="space-y-4">
                {data?.results.map((result: Record<string, any>, idx: number) => (
                  <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                          {result.title || result.name || 'Untitled'}
                        </h3>
                        <p className="text-slate-600 mt-1">{result.company || result.headline || 'No details'}</p>
                        <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
                          {result.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {result.location}
                            </span>
                          )}
                          {result.type && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-4 h-4" />
                              {result.type}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {(!data?.results || data.results.length === 0) && (
                  <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 border-dashed">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No results found</h3>
                    <p className="text-slate-500">Try adjusting your filters or search terms.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
      <SearchContent />
    </Suspense>
  );
}

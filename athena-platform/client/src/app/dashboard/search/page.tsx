'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Briefcase,
  Users,
  GraduationCap,
  Building2,
  FileText,
  X,
} from 'lucide-react';
import { cn, formatSalary, formatRelativeTime } from '@/lib/utils';
import { Avatar, Badge } from '@/components/ui';
import { searchApi } from '@/lib/api';

type SearchCategory = 'all' | 'jobs' | 'people' | 'mentors' | 'videos' | 'courses' | 'companies' | 'posts';
type ApiSearchType = 'all' | 'users' | 'posts' | 'jobs' | 'courses' | 'videos' | 'mentors';

interface ApiMetadata {
  [key: string]: unknown;
  location?: string;
  city?: string;
  state?: string;
  company?: { name?: string; logo?: string };
  salaryMin?: number;
  salaryMax?: number;
  createdAt?: string;
  provider?: string;
  organization?: { logo?: string };
  cost?: number;
  durationMonths?: number;
  author?: { displayName?: string };
  thumbnailUrl?: string;
  viewCount?: number;
  duration?: number;
  headline?: string;
  avatar?: string;
  rating?: number;
  sessionCount?: number;
  likeCount?: number;
  commentCount?: number;
  followers?: number;
}

interface SearchResult {
  id: string;
  type: 'job' | 'person' | 'course' | 'company' | 'post' | 'video' | 'mentor';
  title: string;
  subtitle: string;
  description?: string;
  image?: string;
  url: string;
  metadata?: Record<string, string>;
}

interface ApiSearchResult {
  id: string;
  type: 'user' | 'post' | 'job' | 'course' | 'video' | 'mentor';
  title?: string;
  content?: string;
  highlight?: string;
  metadata: ApiMetadata;
}

interface ApiSearchResponse {
  results: ApiSearchResult[];
  total: number;
  page: number;
  totalPages: number;
  suggestions?: string[];
}

const categories: { value: SearchCategory; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: Search },
  { value: 'jobs', label: 'Jobs', icon: Briefcase },
  { value: 'people', label: 'People', icon: Users },
  { value: 'mentors', label: 'Mentors', icon: Users },
  { value: 'videos', label: 'Videos', icon: FileText },
  { value: 'courses', label: 'Courses', icon: GraduationCap },
  { value: 'companies', label: 'Companies', icon: Building2 },
  { value: 'posts', label: 'Posts', icon: FileText },
];

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<SearchCategory>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const latestQueryRef = useRef(query);

  const mapApiResult = (result: ApiSearchResult): SearchResult => {
    if (result.type === 'job') {
      const location = result.metadata?.location || [result.metadata?.city, result.metadata?.state].filter(Boolean).join(', ');
      return {
        id: result.id,
        type: 'job',
        title: result.title || 'Job',
        subtitle: [result.metadata?.company?.name, location].filter(Boolean).join(' • '),
        description: result.content,
        image: result.metadata?.company?.logo || undefined,
        url: `/dashboard/jobs/${result.id}`,
        metadata: {
          salary: result.metadata?.salaryMin || result.metadata?.salaryMax
            ? `${formatSalary(result.metadata?.salaryMin || 0)} - ${formatSalary(result.metadata?.salaryMax || 0)}`
            : 'Competitive',
          ...(result.metadata?.createdAt && { posted: formatRelativeTime(result.metadata.createdAt) }),
        },
      };
    }

    if (result.type === 'course') {
      return {
        id: result.id,
        type: 'course',
        title: result.title || 'Course',
        subtitle: result.metadata?.provider || 'Course Provider',
        description: result.content,
        image: result.metadata?.organization?.logo || undefined,
        url: `/dashboard/learn/${result.id}`,
        metadata: {
          price: result.metadata?.cost ? `$${result.metadata.cost}` : 'Free',
          ...(result.metadata?.durationMonths && { duration: `${result.metadata.durationMonths} months` }),
        },
      };
    }

    if (result.type === 'video') {
      return {
        id: result.id,
        type: 'video',
        title: result.title || 'Video',
        subtitle: result.metadata?.author?.displayName ? `Video • ${result.metadata.author.displayName}` : 'Video',
        description: result.content,
        image: result.metadata?.thumbnailUrl || undefined,
        url: `/dashboard/community?video=${result.id}`,
        metadata: {
          ...(result.metadata?.viewCount && { views: `${result.metadata.viewCount} views` }),
          ...(result.metadata?.duration && { duration: `${result.metadata.duration} sec` }),
        },
      };
    }

    if (result.type === 'mentor') {
      return {
        id: result.id,
        type: 'mentor',
        title: result.title || 'Mentor',
        subtitle: result.metadata?.headline || 'Mentor',
        description: result.content,
        image: result.metadata?.avatar || undefined,
        url: `/dashboard/mentors/${result.id}`,
        metadata: {
          ...(result.metadata?.rating && { rating: `${result.metadata.rating} rating` }),
          ...(result.metadata?.sessionCount && { sessions: `${result.metadata.sessionCount} sessions` }),
        },
      };
    }

    if (result.type === 'post') {
      return {
        id: result.id,
        type: 'post',
        title: result.title || 'Community post',
        subtitle: result.metadata?.author?.displayName ? `Posted by ${result.metadata.author.displayName}` : 'Community post',
        description: result.content,
        url: `/dashboard/community?post=${result.id}`,
        metadata: {
          ...(result.metadata?.likeCount && { likes: `${result.metadata.likeCount} likes` }),
          ...(result.metadata?.commentCount && { comments: `${result.metadata.commentCount} comments` }),
        },
      };
    }

    return {
      id: result.id,
      type: 'person',
      title: result.title || 'Member',
      subtitle: result.content || 'ATHENA member',
      description: result.content,
      image: result.metadata?.avatar || undefined,
      url: `/dashboard/profile/${result.id}`,
      metadata: {
        ...(result.metadata?.followers && { followers: `${result.metadata.followers} followers` }),
      },
    };
  };

  const mapCategoryToApiType = (value: SearchCategory): ApiSearchType => {
    if (value === 'people') return 'users';
    if (value === 'videos') return 'videos';
    if (value === 'mentors') return 'mentors';
    if (value === 'jobs') return 'jobs';
    if (value === 'courses') return 'courses';
    if (value === 'posts') return 'posts';
    return 'all';
  };

  const performSearch = useCallback(async (searchQuery: string, categoryValue: SearchCategory) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }

    setIsLoading(true);
    setSearchError(null);

    try {
      const response = await searchApi.unified({
        q: searchQuery,
        type: mapCategoryToApiType(categoryValue),
        limit: 25,
      });

      const payload = (response.data?.results
        ? response.data
        : response.data?.data) as ApiSearchResponse;
      const mapped = payload.results.map(mapApiResult);
      setResults(mapped);
    } catch (error) {
      console.error('Search failed', error);
      setResults([]);
      setSearchError('Search is temporarily unavailable. Please try again in a moment.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery, 'all');
    }
  }, [initialQuery, performSearch]);

  useEffect(() => {
    latestQueryRef.current = query;
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, category);
  };

  useEffect(() => {
    const activeQuery = latestQueryRef.current;
    if (activeQuery.trim()) {
      performSearch(activeQuery, category);
    }
  }, [category, performSearch]);

  const filteredResults =
    category === 'all'
      ? results
      : results.filter((r) => {
          if (category === 'jobs') return r.type === 'job';
          if (category === 'people') return r.type === 'person';
          if (category === 'mentors') return r.type === 'mentor';
          if (category === 'videos') return r.type === 'video';
          if (category === 'courses') return r.type === 'course';
          if (category === 'companies') return r.type === 'company';
          if (category === 'posts') return r.type === 'post';
          return true;
        });

  const resultCounts = {
    all: results.length,
    jobs: results.filter((r) => r.type === 'job').length,
    people: results.filter((r) => r.type === 'person').length,
    mentors: results.filter((r) => r.type === 'mentor').length,
    videos: results.filter((r) => r.type === 'video').length,
    courses: results.filter((r) => r.type === 'course').length,
    companies: results.filter((r) => r.type === 'company').length,
    posts: results.filter((r) => r.type === 'post').length,
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'job':
        return Briefcase;
      case 'person':
        return Users;
      case 'mentor':
        return Users;
      case 'video':
        return FileText;
      case 'course':
        return GraduationCap;
      case 'company':
        return Building2;
      case 'post':
        return FileText;
      default:
        return Search;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Search Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          Search
        </h1>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs, people, mentors, videos, courses..."
            className="w-full pl-12 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-lg focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </form>
      </div>

      {/* Category Tabs */}
      {results.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={cn(
                'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition',
                category === cat.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              )}
            >
              <cat.icon className="w-4 h-4" />
              <span>{cat.label}</span>
              <span
                className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full',
                  category === cat.value
                    ? 'bg-white/20'
                    : 'bg-slate-200 dark:bg-slate-600'
                )}
              >
                {resultCounts[cat.value]}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredResults.length > 0 ? (
        <div className="space-y-4">
          {filteredResults.map((result) => {
            const Icon = getResultIcon(result.type);

            return (
              <Link
                key={result.id}
                href={result.url}
                className="card-hover block"
              >
                <div className="flex items-start space-x-4">
                  {result.image ? (
                    <Avatar
                      src={result.image}
                      alt={result.title}
                      size="lg"
                      className={cn(
                        result.type === 'course' && 'rounded-lg w-20 h-12 object-cover'
                      )}
                    />
                  ) : (
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                      <Icon className="w-6 h-6 text-slate-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          {result.title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {result.subtitle}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {result.type}
                      </Badge>
                    </div>

                    {result.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                        {result.description}
                      </p>
                    )}

                    {result.metadata && (
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {Object.entries(result.metadata).map(([key, value]) => (
                          <span key={key}>{value}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : query && !isLoading ? (
        <div className="card text-center py-16">
          <Search className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            {searchError ? 'Search unavailable' : 'No results found'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {searchError
              ? searchError
              : `We couldn't find anything matching "${query}". Try different keywords or check your spelling.`}
          </p>
          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Popular Searches
            </h4>
            <div className="flex flex-wrap justify-center gap-2">
              {['Product Manager', 'Remote Jobs', 'Leadership', 'Tech'].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setQuery(term);
                    performSearch(term, category);
                  }}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center py-16">
          <Search className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            Start searching
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Search for jobs, connect with professionals, find courses, and discover
            companies.
          </p>
          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Popular Searches
            </h4>
            <div className="flex flex-wrap justify-center gap-2">
              {['Product Manager', 'Software Engineer', 'Remote', 'Leadership'].map(
                (term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setQuery(term);
                      performSearch(term, category);
                    }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                  >
                    {term}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

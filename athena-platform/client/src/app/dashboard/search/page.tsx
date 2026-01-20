'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Briefcase,
  Users,
  GraduationCap,
  Building2,
  FileText,
  Filter,
  X,
  MapPin,
  Clock,
} from 'lucide-react';
import { cn, formatSalary, formatRelativeTime } from '@/lib/utils';
import { Avatar, Badge } from '@/components/ui';
import { searchApi } from '@/lib/api';

type SearchCategory = 'all' | 'jobs' | 'people' | 'mentors' | 'videos' | 'courses' | 'companies' | 'posts';

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
  metadata: Record<string, any>;
}

interface ApiSearchResponse {
  results: ApiSearchResult[];
  total: number;
  page: number;
  totalPages: number;
  suggestions?: string[];
}

// Mock search results
const mockResults: SearchResult[] = [
  {
    id: '1',
    type: 'job',
    title: 'Senior Product Manager',
    subtitle: 'Google • San Francisco, CA',
    description: 'Lead product strategy for Google Cloud AI products...',
    image: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=100',
    url: '/dashboard/jobs/1',
    metadata: { salary: '$180,000 - $250,000', posted: '2 days ago' },
  },
  {
    id: '2',
    type: 'job',
    title: 'Product Manager',
    subtitle: 'Meta • Menlo Park, CA',
    description: 'Drive product development for Instagram features...',
    image: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100',
    url: '/dashboard/jobs/2',
    metadata: { salary: '$150,000 - $200,000', posted: '1 week ago' },
  },
  {
    id: '3',
    type: 'person',
    title: 'Sarah Chen',
    subtitle: 'Senior Product Manager at Google',
    description: 'Passionate about women in tech. Open to mentoring.',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    url: '/dashboard/profile/sarah',
  },
  {
    id: '4',
    type: 'person',
    title: 'Emily Johnson',
    subtitle: 'Engineering Manager at Stripe',
    description: 'Building the future of payments. Career coach.',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100',
    url: '/dashboard/profile/emily',
  },
  {
    id: '5',
    type: 'course',
    title: 'Product Management Fundamentals',
    subtitle: 'By Sarah Chen • 8 hours • 4.9 rating',
    description: 'Learn the core skills needed to become a product manager...',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=200',
    url: '/dashboard/learn/1',
    metadata: { price: '$99', enrolled: '2,345 enrolled' },
  },
  {
    id: '6',
    type: 'company',
    title: 'Google',
    subtitle: 'Technology • Mountain View, CA',
    description: 'Organizing the world\'s information and making it accessible...',
    image: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=100',
    url: '/dashboard/organizations/google',
    metadata: { jobs: '45 open positions', followers: '12K followers' },
  },
  {
    id: '7',
    type: 'post',
    title: 'How I Landed My Dream PM Role at Google',
    subtitle: 'Posted by Sarah Chen • 3 days ago',
    description: 'After 6 months of preparation and 10 interviews, I finally got the offer...',
    url: '/dashboard/community?post=1',
    metadata: { likes: '234 likes', comments: '45 comments' },
  },
  {
    id: '8',
    type: 'video',
    title: 'Negotiating Your Salary with Confidence',
    subtitle: 'Video • 8 min • 12.3K views',
    description: 'A practical walkthrough for structuring your negotiation call.',
    url: '/community?video=salary-negotiation',
    metadata: { duration: '08:12', views: '12.3K views' },
  },
  {
    id: '9',
    type: 'mentor',
    title: 'Priya Patel',
    subtitle: 'Career Coach • Product Leadership',
    description: 'Mentoring mid-career PMs on leadership growth and transitions.',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100',
    url: '/mentors/priya-patel',
    metadata: { sessions: '120 sessions', rating: '4.9 rating' },
  },
];

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
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<SearchCategory>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
        url: `/jobs/${result.id}`,
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
        url: `/community?video=${result.id}`,
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

  const mapCategoryToApiType = (value: SearchCategory) => {
    if (value === 'people') return 'users';
    if (value === 'videos') return 'videos';
    if (value === 'mentors') return 'mentors';
    if (value === 'jobs') return 'jobs';
    if (value === 'courses') return 'courses';
    if (value === 'posts') return 'posts';
    return 'all';
  };

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const performSearch = async (searchQuery: string, nextCategory?: SearchCategory) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const categoryValue = nextCategory || category;

    try {
      const response = await searchApi.unified({
        q: searchQuery,
        type: mapCategoryToApiType(categoryValue) as any,
        limit: 25,
      });

      const payload = response.data as ApiSearchResponse;
      const mapped = payload.results.map(mapApiResult);
      setResults(mapped);
    } catch (error) {
      console.error('Search failed, using fallback results', error);
      const filtered = mockResults.filter(
        (result) =>
          result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setResults(filtered);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  useEffect(() => {
    if (query.trim()) {
      performSearch(query, category);
    }
  }, [category]);

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Search
        </h1>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs, people, mentors, videos, courses..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-lg focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              <cat.icon className="w-4 h-4" />
              <span>{cat.label}</span>
              <span
                className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full',
                  category === cat.value
                    ? 'bg-white/20'
                    : 'bg-gray-200 dark:bg-gray-600'
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
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
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
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <Icon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {result.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {result.subtitle}
                        </p>
                      </div>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {result.type}
                      </Badge>
                    </div>

                    {result.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                        {result.description}
                      </p>
                    )}

                    {result.metadata && (
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
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
          <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No results found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            We couldn't find anything matching "{query}". Try different keywords or
            check your spelling.
          </p>
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Popular Searches
            </h4>
            <div className="flex flex-wrap justify-center gap-2">
              {['Product Manager', 'Remote Jobs', 'Leadership', 'Tech'].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setQuery(term);
                    performSearch(term);
                  }}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center py-16">
          <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Start searching
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Search for jobs, connect with professionals, find courses, and discover
            companies.
          </p>
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Popular Searches
            </h4>
            <div className="flex flex-wrap justify-center gap-2">
              {['Product Manager', 'Software Engineer', 'Remote', 'Leadership'].map(
                (term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setQuery(term);
                      performSearch(term);
                    }}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition"
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

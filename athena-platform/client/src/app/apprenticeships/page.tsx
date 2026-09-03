'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApprenticeshipCard,
  ApprenticeshipFiltersBar,
  ApplicationModal,
  Apprenticeship,
  ApprenticeshipFilters,
  ApplicationData,
} from '@/components/apprenticeships';
import { apprenticeshipApi } from '@/lib/api-extensions';
import { Loader2, GraduationCap, TrendingUp, Bookmark, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageShell, PageHero } from '@/components/layout/PageShell';

const PAGE_SIZE = 12;

const EMPTY_FILTERS: ApprenticeshipFilters = {
  search: '',
  framework: [],
  level: [],
  location: '',
  remote: null,
};

export default function ApprenticeshipsPage() {
  const router = useRouter();
  const [apprenticeships, setApprenticeships] = useState<Apprenticeship[]>([]);
  const [featuredApprenticeships, setFeaturedApprenticeships] = useState<Apprenticeship[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ApprenticeshipFilters>({
    search: '',
    framework: [],
    level: [],
    location: '',
    remote: null,
  });
  const [frameworks, setFrameworks] = useState<{ name: string; count: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedApprenticeship, setSelectedApprenticeship] = useState<Apprenticeship | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // The cities we can actually filter on. `location` maps to the server's
  // `city` param, so these are city names rather than "City, Country" labels —
  // sending the label matched nothing.
  const locations = [
    'Brisbane',
    'Sydney',
    'Melbourne',
    'Perth',
    'Adelaide',
    'Canberra',
    'Hobart',
    'Darwin',
  ];

  // Fetch apprenticeships
  const fetchApprenticeships = useCallback(async (pageNum: number, reset: boolean = false) => {
    try {
      setLoading(true);
      // The server reads `framework` and `city`, one value each, and matches
      // `level` against the AQF enum. It has no `industry` param at all.
      const response = await apprenticeshipApi.getAll({
        page: pageNum,
        limit: PAGE_SIZE,
        search: filters.search || undefined,
        framework: filters.framework[0] || undefined,
        level: filters.level[0] || undefined,
        city: filters.location || undefined,
        remote: filters.remote ?? undefined,
      });

      // `{ success, data: [...], pagination }` — data is the array itself. This
      // used to read `data.apprenticeships`, a key that has never existed, so
      // the grid was permanently empty however many listings were open.
      const payload = response.data;
      const data: Apprenticeship[] = Array.isArray(payload?.data) ? payload.data : [];
      const pagination = payload?.pagination;

      if (reset) {
        setApprenticeships(data);
      } else {
        setApprenticeships((prev) => [...prev, ...data]);
      }

      setTotal(pagination?.total ?? data.length);
      setHasMore(
        pagination ? pagination.page < pagination.pages : data.length === PAGE_SIZE
      );
    } catch (error) {
      console.error('Failed to fetch apprenticeships:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch featured apprenticeships
  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const response = await apprenticeshipApi.getFeatured();
        const data = response.data?.data;
        setFeaturedApprenticeships(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch featured:', error);
      }
    };
    fetchFeatured();
  }, []);

  // The filter bar offers what the catalogue actually contains rather than a
  // hardcoded list of industries the schema has no column for.
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await apprenticeshipApi.getCategories();
        const data = response.data?.data;
        setFrameworks(Array.isArray(data?.frameworks) ? data.frameworks : []);
      } catch (error) {
        console.error('Failed to fetch apprenticeship categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // Initial load and filter changes
  useEffect(() => {
    setPage(1);
    fetchApprenticeships(1, true);
  }, [fetchApprenticeships]);

  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.framework.length > 0 ||
    filters.level.length > 0 ||
    Boolean(filters.location) ||
    filters.remote !== null;

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchApprenticeships(nextPage);
  };

  const handleApply = (id: string) => {
    const apprenticeship = apprenticeships.find((a) => a.id === id) || 
                          featuredApprenticeships.find((a) => a.id === id);
    if (apprenticeship) {
      setSelectedApprenticeship(apprenticeship);
      setShowApplicationModal(true);
    }
  };

  const handleBookmark = async (id: string) => {
    try {
      const apprenticeship = apprenticeships.find((a) => a.id === id);
      if (apprenticeship?.isBookmarked) {
        await apprenticeshipApi.unbookmark(id);
      } else {
        await apprenticeshipApi.bookmark(id);
      }

      const updateBookmark = (list: Apprenticeship[]) =>
        list.map((a) => (a.id === id ? { ...a, isBookmarked: !a.isBookmarked } : a));

      setApprenticeships(updateBookmark);
      setFeaturedApprenticeships(updateBookmark);
    } catch (error) {
      console.error('Failed to bookmark:', error);
    }
  };

  const handleShare = async (id: string) => {
    try {
      await navigator.share({
        title: 'Check out this apprenticeship on Athena',
        url: `${window.location.origin}/apprenticeships/${id}`,
      });
    } catch {
      navigator.clipboard.writeText(`${window.location.origin}/apprenticeships/${id}`);
    }
  };

  const handleApplicationSubmit = async (data: ApplicationData) => {
    if (!selectedApprenticeship) return;
    
    await apprenticeshipApi.apply(selectedApprenticeship.id, {
      coverLetter: data.coverLetter,
      resumeUrl: data.resumeUrl,
      portfolioUrl: data.portfolioUrl,
      availableStartDate: data.availableStartDate,
      answers: data.answers,
    });
  };

  const handleViewDetails = (id: string) => {
    router.push(`/apprenticeships/${id}`);
  };

  return (
    <PageShell width="wide">
      <PageHero
        kicker="Apprenticeships"
        title="Get paid while you learn the trade"
        description="Apprenticeships and traineeships with a registered training organisation — you work, you study, and you finish with a nationally recognised qualification."
        primaryAction={{ label: 'Browse openings', href: '#all-apprenticeships' }}
        secondaryAction={{ label: 'How it works', href: '/help/getting-started' }}
      />

      <div className="mt-8">
        {/* Featured Section */}
        {featuredApprenticeships.length > 0 && (
          <section className="mb-12">
            <h2 className="rail-title mb-4">Featured</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredApprenticeships.slice(0, 3).map((apprenticeship) => (
                <ApprenticeshipCard
                  key={apprenticeship.id}
                  apprenticeship={apprenticeship}
                  onApply={handleApply}
                  onBookmark={handleBookmark}
                  onShare={handleShare}
                  onClick={handleViewDetails}
                />
              ))}
            </div>
          </section>
        )}

        {/* Filters */}
        <section className="mb-8">
          <ApprenticeshipFiltersBar
            filters={filters}
            onFiltersChange={setFilters}
            frameworks={frameworks}
            locations={locations}
          />
        </section>

        {/* Results */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 id="all-apprenticeships" className="rail-title">
              All apprenticeships
            </h2>
            <span className="text-sm text-slate-500">
              {total} {total === 1 ? 'opportunity' : 'opportunities'} found
            </span>
          </div>

          {loading && apprenticeships.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            </div>
          ) : apprenticeships.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              {hasActiveFilters ? (
                <>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    Nothing matches those filters
                  </h3>
                  <p className="text-slate-500 mb-4">
                    Widen the search and see what else is open.
                  </p>
                  <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Clear filters
                  </Button>
                </>
              ) : (
                /* Telling someone to adjust filters they never set sends them
                   hunting for listings that are not there. When the catalogue
                   itself is empty, say so and point at the people who can fill
                   it. */
                <>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    No apprenticeships listed yet
                  </h3>
                  <p className="mx-auto mb-4 max-w-md text-slate-500">
                    Providers and host employers are still coming on board. Register
                    and we will tell you the moment one opens in your trade.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => router.push('/register')}>
                      Get notified
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => router.push('/contact-sales?intent=apprenticeships')}
                    >
                      List an apprenticeship
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {apprenticeships.map((apprenticeship) => (
                  <ApprenticeshipCard
                    key={apprenticeship.id}
                    apprenticeship={apprenticeship}
                    onApply={handleApply}
                    onBookmark={handleBookmark}
                    onShare={handleShare}
                    onClick={handleViewDetails}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Application Modal */}
      {selectedApprenticeship && (
        <ApplicationModal
          isOpen={showApplicationModal}
          onClose={() => {
            setShowApplicationModal(false);
            setSelectedApprenticeship(null);
          }}
          apprenticeship={selectedApprenticeship}
          onSubmit={handleApplicationSubmit}
        />
      )}
    </PageShell>
  );
}

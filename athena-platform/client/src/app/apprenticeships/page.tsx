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

export default function ApprenticeshipsPage() {
  const router = useRouter();
  const [apprenticeships, setApprenticeships] = useState<Apprenticeship[]>([]);
  const [featuredApprenticeships, setFeaturedApprenticeships] = useState<Apprenticeship[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ApprenticeshipFilters>({
    search: '',
    industry: [],
    level: [],
    location: '',
    remote: null,
  });
  const [selectedApprenticeship, setSelectedApprenticeship] = useState<Apprenticeship | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Static data for filters (would come from API)
  const industries = [
    'Technology',
    'Healthcare',
    'Finance',
    'Marketing',
    'Design',
    'Engineering',
    'Legal',
    'Education',
  ];
  const locations = [
    'Sydney, Australia',
    'Melbourne, Australia',
    'Brisbane, Australia',
    'Auckland, New Zealand',
    'Remote',
  ];

  // Fetch apprenticeships
  const fetchApprenticeships = useCallback(async (pageNum: number, reset: boolean = false) => {
    try {
      setLoading(true);
      const response = await apprenticeshipApi.getAll({
        page: pageNum,
        limit: 12,
        search: filters.search,
        industry: filters.industry.join(','),
        level: filters.level.join(','),
        location: filters.location,
        remote: filters.remote ?? undefined,
      });
      
      const data = response.data.data?.apprenticeships || [];
      
      if (reset) {
        setApprenticeships(data);
      } else {
        setApprenticeships((prev) => [...prev, ...data]);
      }
      
      setHasMore(data.length === 12);
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
        setFeaturedApprenticeships(response.data.data?.apprenticeships || []);
      } catch (error) {
        console.error('Failed to fetch featured:', error);
      }
    };
    fetchFeatured();
  }, []);

  // Initial load and filter changes
  useEffect(() => {
    setPage(1);
    fetchApprenticeships(1, true);
  }, [fetchApprenticeships]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold mb-4">
              Launch Your Career with an Apprenticeship
            </h1>
            <p className="text-lg text-primary-100 mb-8">
              Gain hands-on experience, earn while you learn, and build the skills employers are looking for. 
              Designed specifically for women entering or advancing in their careers.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                <GraduationCap className="w-5 h-5" />
                <span>Earn certifications</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                <TrendingUp className="w-5 h-5" />
                <span>Career growth</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                <Award className="w-5 h-5" />
                <span>Mentorship included</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Featured Section */}
        {featuredApprenticeships.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Featured Opportunities
            </h2>
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
            industries={industries}
            locations={locations}
          />
        </section>

        {/* Results */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              All Apprenticeships
            </h2>
            <span className="text-sm text-gray-500">
              {apprenticeships.length} opportunities found
            </span>
          </div>

          {loading && apprenticeships.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          ) : apprenticeships.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl">
              <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No apprenticeships found
              </h3>
              <p className="text-gray-500 mb-4">
                Try adjusting your filters to see more opportunities
              </p>
              <Button variant="outline" onClick={() => setFilters({
                search: '',
                industry: [],
                level: [],
                location: '',
                remote: null,
              })}>
                Clear Filters
              </Button>
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
    </div>
  );
}

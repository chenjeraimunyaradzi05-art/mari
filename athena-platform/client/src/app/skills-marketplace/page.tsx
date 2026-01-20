'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ServiceCard,
  MarketplaceFiltersBar,
  OrderModal,
  SkillService,
  MarketplaceFilters,
} from '@/components/skills-marketplace';
import { skillsMarketplaceApi } from '@/lib/api-extensions';
import { Loader2, Sparkles, TrendingUp, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SkillsMarketplacePage() {
  const router = useRouter();
  const [services, setServices] = useState<SkillService[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<MarketplaceFilters>({
    search: '',
    category: '',
    subcategory: '',
    deliveryTime: '',
    sellerLevel: [],
    sortBy: 'recommended',
  });
  const [selectedService, setSelectedService] = useState<SkillService | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalResults, setTotalResults] = useState(0);

  // Categories data
  const categories = [
    {
      name: 'Design & Creative',
      subcategories: ['Logo Design', 'Brand Identity', 'UI/UX Design', 'Illustration', 'Video Editing'],
    },
    {
      name: 'Writing & Translation',
      subcategories: ['Copywriting', 'Content Writing', 'Translation', 'Proofreading', 'Resume Writing'],
    },
    {
      name: 'Digital Marketing',
      subcategories: ['SEO', 'Social Media Marketing', 'Email Marketing', 'PPC', 'Content Strategy'],
    },
    {
      name: 'Programming & Tech',
      subcategories: ['Web Development', 'Mobile Apps', 'WordPress', 'E-commerce', 'Data Science'],
    },
    {
      name: 'Business',
      subcategories: ['Virtual Assistant', 'Consulting', 'Financial Planning', 'Legal Services', 'HR Services'],
    },
    {
      name: 'Coaching & Mentoring',
      subcategories: ['Career Coaching', 'Life Coaching', 'Interview Prep', 'Leadership', 'Wellness'],
    },
  ];

  // Fetch services
  const fetchServices = useCallback(async (pageNum: number, reset: boolean = false) => {
    try {
      setLoading(true);
      const response = await skillsMarketplaceApi.getServices({
        page: pageNum,
        limit: 12,
        search: filters.search,
        category: filters.category,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        deliveryTime: filters.deliveryTime,
        rating: filters.minRating,
      });
      
      const data = response.data.data?.services || [];
      const total = response.data.data?.total || 0;
      
      if (reset) {
        setServices(data);
      } else {
        setServices((prev) => [...prev, ...data]);
      }
      
      setTotalResults(total);
      setHasMore(data.length === 12);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial load and filter changes
  useEffect(() => {
    setPage(1);
    fetchServices(1, true);
  }, [fetchServices]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchServices(nextPage);
  };

  const handleFavorite = async (id: string) => {
    try {
      const service = services.find((s) => s.id === id);
      if (service?.isFavorite) {
        await skillsMarketplaceApi.unfavoriteService(id);
      } else {
        await skillsMarketplaceApi.favoriteService(id);
      }

      setServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s))
      );
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleShare = async (id: string) => {
    try {
      await navigator.share({
        title: 'Check out this service on Athena',
        url: `${window.location.origin}/skills-marketplace/${id}`,
      });
    } catch {
      navigator.clipboard.writeText(`${window.location.origin}/skills-marketplace/${id}`);
    }
  };

  const handleServiceClick = (id: string) => {
    router.push(`/skills-marketplace/${id}`);
  };

  const handleOrder = (id: string) => {
    const service = services.find((s) => s.id === id);
    if (service) {
      setSelectedService(service);
      setShowOrderModal(true);
    }
  };

  const handleOrderSubmit = async (packageIndex: number, requirements: string) => {
    if (!selectedService) return;
    
    await skillsMarketplaceApi.placeOrder(selectedService.id, {
      packageIndex,
      requirements,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-secondary-600 to-secondary-800 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold mb-4">
              Skills Marketplace
            </h1>
            <p className="text-lg text-secondary-100 mb-8">
              Connect with talented women offering professional services. From design to development,
              marketing to mentoring – find the perfect expert for your project.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                <Sparkles className="w-5 h-5" />
                <span>Quality verified</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                <Clock className="w-5 h-5" />
                <span>Fast delivery</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                <Star className="w-5 h-5" />
                <span>Top-rated sellers</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Popular Categories */}
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Popular Categories
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setFilters({ ...filters, category: cat.name })}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filters.category === cat.name
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary-500'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-12">
        {/* Filters */}
        <section className="mb-8">
          <MarketplaceFiltersBar
            filters={filters}
            onFiltersChange={setFilters}
            categories={categories}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            resultCount={totalResults}
          />
        </section>

        {/* Results */}
        {loading && services.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No services found
            </h3>
            <p className="text-gray-500 mb-4">
              Try adjusting your filters or search terms
            </p>
            <Button
              variant="outline"
              onClick={() =>
                setFilters({
                  search: '',
                  category: '',
                  subcategory: '',
                  deliveryTime: '',
                  sellerLevel: [],
                  sortBy: 'recommended',
                })
              }
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'space-y-4'
              }
            >
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  variant={viewMode === 'list' ? 'horizontal' : 'default'}
                  onFavorite={handleFavorite}
                  onShare={handleShare}
                  onClick={handleServiceClick}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
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
      </div>

      {/* Order Modal */}
      {selectedService && (
        <OrderModal
          isOpen={showOrderModal}
          onClose={() => {
            setShowOrderModal(false);
            setSelectedService(null);
          }}
          service={selectedService}
          onOrder={handleOrderSubmit}
        />
      )}
    </div>
  );
}

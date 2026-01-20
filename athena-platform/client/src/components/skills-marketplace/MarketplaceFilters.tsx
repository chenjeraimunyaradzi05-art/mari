'use client';

import { useState } from 'react';
import { Search, Filter, SlidersHorizontal, Grid, List, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface MarketplaceFilters {
  search: string;
  category: string;
  subcategory: string;
  minPrice?: number;
  maxPrice?: number;
  deliveryTime: string;
  sellerLevel: string[];
  minRating?: number;
  sortBy: 'recommended' | 'price_low' | 'price_high' | 'rating' | 'newest' | 'bestselling';
}

interface MarketplaceFiltersBarProps {
  filters: MarketplaceFilters;
  onFiltersChange: (filters: MarketplaceFilters) => void;
  categories: Array<{ name: string; subcategories: string[] }>;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  resultCount?: number;
}

export function MarketplaceFiltersBar({
  filters,
  onFiltersChange,
  categories,
  viewMode,
  onViewModeChange,
  resultCount,
}: MarketplaceFiltersBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const deliveryOptions = [
    { value: '', label: 'Any' },
    { value: '1', label: 'Up to 1 day' },
    { value: '3', label: 'Up to 3 days' },
    { value: '7', label: 'Up to 7 days' },
    { value: '14', label: 'Up to 14 days' },
  ];

  const sellerLevels = [
    { value: 'pro', label: 'Pro Sellers' },
    { value: 'top', label: 'Top Rated' },
    { value: 'rising', label: 'Rising Stars' },
    { value: 'new', label: 'New Sellers' },
  ];

  const sortOptions = [
    { value: 'recommended', label: 'Recommended' },
    { value: 'bestselling', label: 'Best Selling' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'newest', label: 'Newest' },
    { value: 'price_low', label: 'Price: Low to High' },
    { value: 'price_high', label: 'Price: High to Low' },
  ];

  const updateFilter = <K extends keyof MarketplaceFilters>(
    key: K,
    value: MarketplaceFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleSellerLevel = (level: string) => {
    const current = filters.sellerLevel;
    const updated = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    updateFilter('sellerLevel', updated);
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      category: '',
      subcategory: '',
      deliveryTime: '',
      sellerLevel: [],
      sortBy: 'recommended',
    });
  };

  const activeFiltersCount =
    (filters.category ? 1 : 0) +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) +
    (filters.deliveryTime ? 1 : 0) +
    filters.sellerLevel.length +
    (filters.minRating ? 1 : 0);

  const selectedCategory = categories.find((c) => c.name === filters.category);

  return (
    <div className="space-y-4">
      {/* Main search and filters row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search for any service..."
            className="pl-10"
          />
        </div>

        {/* Category dropdown */}
        <select
          value={filters.category}
          onChange={(e) => {
            updateFilter('category', e.target.value);
            updateFilter('subcategory', '');
          }}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Subcategory (if category selected) */}
        {selectedCategory && selectedCategory.subcategories.length > 0 && (
          <select
            value={filters.subcategory}
            onChange={(e) => updateFilter('subcategory', e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Subcategories</option>
            {selectedCategory.subcategories.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        )}

        {/* Filters toggle */}
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(activeFiltersCount > 0 && 'border-primary-500')}
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="ml-2 bg-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </Button>

        {/* Sort */}
        <select
          value={filters.sortBy}
          onChange={(e) => updateFilter('sortBy', e.target.value as MarketplaceFilters['sortBy'])}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* View mode toggle */}
        <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <button
            onClick={() => onViewModeChange('grid')}
            className={cn(
              'p-2',
              viewMode === 'grid'
                ? 'bg-primary-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600'
            )}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={cn(
              'p-2',
              viewMode === 'list'
                ? 'bg-primary-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600'
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Results count */}
      {resultCount !== undefined && (
        <p className="text-sm text-gray-500">
          {resultCount.toLocaleString()} services available
        </p>
      )}

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Delivery Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Delivery Time
              </label>
              <select
                value={filters.deliveryTime}
                onChange={(e) => updateFilter('deliveryTime', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {deliveryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Price Range
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.minPrice || ''}
                  onChange={(e) =>
                    updateFilter('minPrice', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.maxPrice || ''}
                  onChange={(e) =>
                    updateFilter('maxPrice', e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </div>
            </div>

            {/* Seller Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Seller Level
              </label>
              <div className="flex flex-wrap gap-2">
                {sellerLevels.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => toggleSellerLevel(level.value)}
                    className={cn(
                      'px-3 py-1 rounded-full text-sm transition-colors',
                      filters.sellerLevel.includes(level.value)
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Min Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Rating
              </label>
              <select
                value={filters.minRating || ''}
                onChange={(e) =>
                  updateFilter('minRating', e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Any</option>
                <option value="4.5">4.5 & up</option>
                <option value="4">4.0 & up</option>
                <option value="3.5">3.5 & up</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" onClick={() => setShowAdvanced(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        </div>
      )}

      {/* Active filter tags */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.category && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full text-sm">
              {filters.category}
              <button onClick={() => updateFilter('category', '')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.deliveryTime && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full text-sm">
              ≤{filters.deliveryTime}d delivery
              <button onClick={() => updateFilter('deliveryTime', '')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.sellerLevel.map((level) => (
            <span
              key={level}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full text-sm"
            >
              {level}
              <button onClick={() => toggleSellerLevel(level)}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export default MarketplaceFiltersBar;

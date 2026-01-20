'use client';

import { useState } from 'react';
import { Search, Filter, MapPin, Clock, Briefcase, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ApprenticeshipFilters {
  search: string;
  industry: string[];
  level: string[];
  location: string;
  remote: boolean | null;
  salaryMin?: number;
  salaryMax?: number;
}

interface ApprenticeshipFiltersProps {
  filters: ApprenticeshipFilters;
  onFiltersChange: (filters: ApprenticeshipFilters) => void;
  industries: string[];
  locations: string[];
}

export function ApprenticeshipFiltersBar({
  filters,
  onFiltersChange,
  industries,
  locations,
}: ApprenticeshipFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const levels = ['entry', 'intermediate', 'advanced'];

  const updateFilter = <K extends keyof ApprenticeshipFilters>(
    key: K,
    value: ApprenticeshipFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: 'industry' | 'level', value: string) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter(key, updated);
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      industry: [],
      level: [],
      location: '',
      remote: null,
    });
  };

  const activeFiltersCount =
    filters.industry.length +
    filters.level.length +
    (filters.location ? 1 : 0) +
    (filters.remote !== null ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search apprenticeships, skills, or companies..."
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(activeFiltersCount > 0 && 'border-primary-500')}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="ml-2 bg-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        {/* Remote toggle */}
        <button
          onClick={() => updateFilter('remote', filters.remote === true ? null : true)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            filters.remote === true
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          )}
        >
          Remote Only
        </button>

        {/* Level filters */}
        {levels.map((level) => (
          <button
            key={level}
            onClick={() => toggleArrayFilter('level', level)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize',
              filters.level.includes(level)
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            {level}
          </button>
        ))}

        {/* Clear all */}
        {activeFiltersCount > 0 && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Industry
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {industries.map((industry) => (
                  <label key={industry} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.industry.includes(industry)}
                      onChange={() => toggleArrayFilter('industry', industry)}
                      className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{industry}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Location
              </label>
              <select
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Salary Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Salary Range (yearly)
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.salaryMin || ''}
                  onChange={(e) => updateFilter('salaryMin', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-1/2"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.salaryMax || ''}
                  onChange={(e) => updateFilter('salaryMax', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-1/2"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowAdvanced(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprenticeshipFiltersBar;

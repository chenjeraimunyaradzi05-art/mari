/**
 * Search Store - Global Search State
 * Phase 3: Web Client - Super App Core
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SearchCategory = 'all' | 'users' | 'jobs' | 'posts' | 'courses' | 'groups' | 'mentors';

export interface SearchResult {
  id: string;
  type: SearchCategory;
  title: string;
  subtitle?: string;
  image?: string;
  url: string;
  metadata?: Record<string, any>;
  relevanceScore?: number;
}

export interface RecentSearch {
  id: string;
  query: string;
  category: SearchCategory;
  timestamp: number;
  resultCount?: number;
}

export interface SavedSearch {
  id: string;
  query: string;
  category: SearchCategory;
  filters?: Record<string, any>;
  createdAt: number;
  alertEnabled?: boolean;
}

interface SearchState {
  // Query
  query: string;
  setQuery: (query: string) => void;
  
  // Category filter
  activeCategory: SearchCategory;
  setCategory: (category: SearchCategory) => void;
  
  // Advanced filters
  filters: Record<string, any>;
  setFilters: (filters: Record<string, any>) => void;
  clearFilters: () => void;
  
  // Results
  results: SearchResult[];
  setResults: (results: SearchResult[]) => void;
  clearResults: () => void;
  
  // Loading
  isSearching: boolean;
  setSearching: (searching: boolean) => void;
  
  // Recent searches
  recentSearches: RecentSearch[];
  addRecentSearch: (query: string, category: SearchCategory, resultCount?: number) => void;
  removeRecentSearch: (id: string) => void;
  clearRecentSearches: () => void;
  
  // Saved searches
  savedSearches: SavedSearch[];
  saveSearch: (query: string, category: SearchCategory, filters?: Record<string, any>) => void;
  removeSavedSearch: (id: string) => void;
  toggleSearchAlert: (id: string) => void;
  
  // Suggestions
  suggestions: string[];
  setSuggestions: (suggestions: string[]) => void;
  
  // Trending searches
  trendingSearches: string[];
  setTrendingSearches: (searches: string[]) => void;
  
  // Selected index for keyboard nav
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  
  // Quick actions
  quickActions: QuickAction[];
  setQuickActions: (actions: QuickAction[]) => void;
  
  // Search history analytics
  searchCount: number;
  incrementSearchCount: () => void;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
}

const MAX_RECENT_SEARCHES = 10;
const MAX_SAVED_SEARCHES = 50;

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      // Query
      query: '',
      setQuery: (query) => set({ query, selectedIndex: -1 }),
      
      // Category
      activeCategory: 'all',
      setCategory: (category) => set({ activeCategory: category }),
      
      // Advanced filters
      filters: {},
      setFilters: (filters) => set({ filters }),
      clearFilters: () => set({ filters: {} }),
      
      // Results
      results: [],
      setResults: (results) => set({ results }),
      clearResults: () => set({ results: [], query: '' }),
      
      // Loading
      isSearching: false,
      setSearching: (searching) => set({ isSearching: searching }),
      
      // Recent searches
      recentSearches: [],
      addRecentSearch: (query, category, resultCount) => {
        if (!query.trim()) return;
        
        get().incrementSearchCount();
        
        set((state) => {
          // Remove duplicate
          const filtered = state.recentSearches.filter(
            (s) => s.query.toLowerCase() !== query.toLowerCase()
          );
          
          const newSearch: RecentSearch = {
            id: `recent-${Date.now()}`,
            query,
            category,
            timestamp: Date.now(),
            resultCount,
          };
          
          return {
            recentSearches: [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES),
          };
        });
      },
      removeRecentSearch: (id) => set((state) => ({
        recentSearches: state.recentSearches.filter((s) => s.id !== id),
      })),
      clearRecentSearches: () => set({ recentSearches: [] }),
      
      // Saved searches
      savedSearches: [],
      saveSearch: (query, category, filters) => {
        if (!query.trim()) return;
        
        set((state) => {
          // Check for duplicates
          if (state.savedSearches.some(
            (s) => s.query.toLowerCase() === query.toLowerCase() && s.category === category
          )) {
            return state;
          }
          
          const newSaved: SavedSearch = {
            id: `saved-${Date.now()}`,
            query,
            category,
            filters,
            createdAt: Date.now(),
            alertEnabled: false,
          };
          
          return {
            savedSearches: [newSaved, ...state.savedSearches].slice(0, MAX_SAVED_SEARCHES),
          };
        });
      },
      removeSavedSearch: (id) => set((state) => ({
        savedSearches: state.savedSearches.filter((s) => s.id !== id),
      })),
      toggleSearchAlert: (id) => set((state) => ({
        savedSearches: state.savedSearches.map((s) =>
          s.id === id ? { ...s, alertEnabled: !s.alertEnabled } : s
        ),
      })),
      
      // Suggestions
      suggestions: [],
      setSuggestions: (suggestions) => set({ suggestions }),
      
      // Trending searches
      trendingSearches: [],
      setTrendingSearches: (searches) => set({ trendingSearches: searches }),
      
      // Keyboard navigation
      selectedIndex: -1,
      setSelectedIndex: (index) => set({ selectedIndex: index }),
      
      // Quick actions
      quickActions: [],
      setQuickActions: (actions) => set({ quickActions: actions }),
      
      // Analytics
      searchCount: 0,
      incrementSearchCount: () => set((state) => ({ searchCount: state.searchCount + 1 })),
    }),
    {
      name: 'athena-search',
      partialize: (state) => ({
        recentSearches: state.recentSearches,
        savedSearches: state.savedSearches,
        searchCount: state.searchCount,
      }),
    }
  )
);

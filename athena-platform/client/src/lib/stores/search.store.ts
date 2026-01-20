/**
 * Search Store - Global Search State
 * Phase 3: Web Client - Super App Core
 */

import { create } from 'zustand';

export type SearchCategory = 'all' | 'users' | 'jobs' | 'posts' | 'courses' | 'groups' | 'mentors';

export interface SearchResult {
  id: string;
  type: SearchCategory;
  title: string;
  subtitle?: string;
  image?: string;
  url: string;
  metadata?: Record<string, any>;
}

export interface RecentSearch {
  id: string;
  query: string;
  category: SearchCategory;
  timestamp: number;
}

interface SearchState {
  // Query
  query: string;
  setQuery: (query: string) => void;
  
  // Category filter
  activeCategory: SearchCategory;
  setCategory: (category: SearchCategory) => void;
  
  // Results
  results: SearchResult[];
  setResults: (results: SearchResult[]) => void;
  clearResults: () => void;
  
  // Loading
  isSearching: boolean;
  setSearching: (searching: boolean) => void;
  
  // Recent searches
  recentSearches: RecentSearch[];
  addRecentSearch: (query: string, category: SearchCategory) => void;
  clearRecentSearches: () => void;
  
  // Suggestions
  suggestions: string[];
  setSuggestions: (suggestions: string[]) => void;
  
  // Selected index for keyboard nav
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  
  // Quick actions
  quickActions: QuickAction[];
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
}

const MAX_RECENT_SEARCHES = 10;

export const useSearchStore = create<SearchState>((set, get) => ({
  // Query
  query: '',
  setQuery: (query) => set({ query, selectedIndex: -1 }),
  
  // Category
  activeCategory: 'all',
  setCategory: (category) => set({ activeCategory: category }),
  
  // Results
  results: [],
  setResults: (results) => set({ results }),
  clearResults: () => set({ results: [], query: '' }),
  
  // Loading
  isSearching: false,
  setSearching: (searching) => set({ isSearching: searching }),
  
  // Recent searches
  recentSearches: [],
  addRecentSearch: (query, category) => {
    if (!query.trim()) return;
    
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
      };
      
      return {
        recentSearches: [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES),
      };
    });
  },
  clearRecentSearches: () => set({ recentSearches: [] }),
  
  // Suggestions
  suggestions: [],
  setSuggestions: (suggestions) => set({ suggestions }),
  
  // Keyboard navigation
  selectedIndex: -1,
  setSelectedIndex: (index) => set({ selectedIndex: index }),
  
  // Quick actions (defined at app level, injected)
  quickActions: [],
}));

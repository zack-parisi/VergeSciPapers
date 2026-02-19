import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

interface Journal {
  id: string;
  name: string;
}

interface JournalSearchState {
  journals: Journal[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
  totalCount: number;
}

interface UseJournalSearchOptions {
  pageSize?: number;
  searchQuery?: string;
  selectedJournals?: Journal[];
}

// Simple in-memory cache
const journalCache = new Map<string, { data: Journal[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useJournalSearch = (options: UseJournalSearchOptions = {}) => {
  const { pageSize = 50, searchQuery = '', selectedJournals = [] } = options;
  
  // Use ref to avoid dependency issues
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  
  const [state, setState] = useState<JournalSearchState>({
    journals: [],
    loading: false,
    error: null,
    hasMore: true,
    currentPage: 1,
    totalCount: 0,
  });

  // Generate cache key
  const cacheKey = useMemo(() => {
    return `journals_${pageSize}_${searchQueryRef.current}_${state.currentPage}`;
  }, [pageSize, state.currentPage]);

  // Check cache
  const getCachedData = useCallback((key: string) => {
    const cached = journalCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }, []);

  // Set cache
  const setCachedData = useCallback((key: string, data: Journal[]) => {
    journalCache.set(key, { data, timestamp: Date.now() });
  }, []);

  // Load journals with pagination
  const loadJournals = useCallback(async (page: number = 1, append: boolean = false) => {
    if (state.loading) return;

    const currentCacheKey = `journals_${pageSize}_${searchQueryRef.current}_${page}`;
    const cached = getCachedData(currentCacheKey);
    
    console.log(' loadJournals called:', {
      page,
      append,
      searchQuery: searchQueryRef.current,
      cacheKey: currentCacheKey,
      cached: !!cached
    });
    
    if (cached && !append) {
      console.log(' Using cached journal data');
      setState(prev => ({
        ...prev,
        journals: cached,
        loading: false,
        currentPage: page,
        hasMore: cached.length === pageSize,
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pageSize.toString());

      // Use searchQueryRef.current instead of searchQuery to avoid dependency issues
      if (searchQueryRef.current) {
        params.append('search', searchQueryRef.current);
      }

      const url = `/api/journals?${params}`;
      console.log(' Fetching journals from:', url);
      
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load journals');
      }

      console.log(' Received journals data:', {
        journalsCount: data.journals?.length || 0,
        pagination: data.pagination
      });

      // Handle both new paginated format and legacy format
      const newJournals = data.journals || data;
      const pagination = data.pagination || null;
      
      // Cache the results
      setCachedData(currentCacheKey, newJournals);

      setState(prev => ({
        ...prev,
        journals: append ? [...prev.journals, ...newJournals] : newJournals,
        loading: false,
        currentPage: page,
        hasMore: pagination ? pagination.hasNextPage : newJournals.length === pageSize,
        totalCount: pagination ? pagination.totalCount : prev.totalCount,
      }));
      
      console.log(' Updated state with journals:', newJournals.length);
    } catch (error) {
      console.error(' Error in loadJournals:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [pageSize, getCachedData, setCachedData]); // Removed searchQuery from dependencies

  // Load more journals
  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore) {
      loadJournals(state.currentPage + 1, true);
    }
  }, [state.loading, state.hasMore, state.currentPage, loadJournals]);

  // Search journals
  const search = useCallback((query: string) => {
    console.log(' search function called with query:', query);
    setState(prev => ({
      ...prev,
      journals: [],
      currentPage: 1,
      hasMore: true,
    }));
    // Trigger the search immediately
    loadJournals(1, false);
  }, [loadJournals]);

  // Reset to initial state
  const reset = useCallback(() => {
    setState({
      journals: [],
      loading: false,
      error: null,
      hasMore: true,
      currentPage: 1,
      totalCount: 0,
    });
  }, []);

  // Load initial data only once on mount
  useEffect(() => {
    loadJournals(1, false);
  }, []); // Empty dependency array - only run on mount

  // Trigger search when searchQuery changes
  useEffect(() => {
    console.log(' searchQuery changed, triggering search:', searchQueryRef.current);
    if (searchQueryRef.current !== undefined) {
      loadJournals(1, false);
    }
  }, [searchQuery, loadJournals]);

  // Filter out already selected journals and ensure unique IDs
  const availableJournals = useMemo(() => {
    const selectedIds = new Set(selectedJournals.map(j => j.id));
    const seenIds = new Set<string>();
    return state.journals
      .filter(journal => !selectedIds.has(journal.id))
      .filter(journal => {
        if (seenIds.has(journal.id)) {
          return false;
        }
        seenIds.add(journal.id);
        return true;
      });
  }, [state.journals, selectedJournals]);

  return {
    // State
    journals: availableJournals,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    currentPage: state.currentPage,
    totalCount: state.totalCount,
    
    // Actions
    loadMore,
    search,
    reset,
    loadJournals,
  };
};

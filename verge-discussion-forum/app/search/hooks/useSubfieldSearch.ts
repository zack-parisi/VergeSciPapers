import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

interface Subfield {
  id: string;
  name: string;
}

interface SubfieldSearchState {
  subfields: Subfield[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
  totalCount: number;
}

interface UseSubfieldSearchOptions {
  pageSize?: number;
  searchQuery?: string;
  selectedSubfields?: Subfield[];
}

// Simple in-memory cache
const subfieldCache = new Map<string, { data: Subfield[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useSubfieldSearch = (options: UseSubfieldSearchOptions = {}) => {
  const { pageSize = 50, searchQuery = '', selectedSubfields = [] } = options;
  
  // Use ref to avoid dependency issues
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  
  const [state, setState] = useState<SubfieldSearchState>({
    subfields: [],
    loading: false,
    error: null,
    hasMore: true,
    currentPage: 1,
    totalCount: 0,
  });

  // Generate cache key
  const cacheKey = useMemo(() => {
    return `subfields_${pageSize}_${searchQueryRef.current}_${state.currentPage}`;
  }, [pageSize, state.currentPage]);

  // Check cache
  const getCachedData = useCallback((key: string) => {
    const cached = subfieldCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }, []);

  // Set cache
  const setCachedData = useCallback((key: string, data: Subfield[]) => {
    subfieldCache.set(key, { data, timestamp: Date.now() });
  }, []);

  // Load subfields with pagination
  const loadSubfields = useCallback(async (page: number = 1, append: boolean = false) => {
    if (state.loading) return;

    const currentCacheKey = `subfields_${pageSize}_${searchQueryRef.current}_${page}`;
    const cached = getCachedData(currentCacheKey);
    
    console.log(' loadSubfields called:', {
      page,
      append,
      searchQuery: searchQueryRef.current,
      cacheKey: currentCacheKey,
      cached: !!cached
    });
    
    if (cached && !append) {
      console.log(' Using cached data');
      setState(prev => ({
        ...prev,
        subfields: cached,
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

      const url = `/api/subfields?${params}`;
      console.log(' Fetching subfields from:', url);
      
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load subfields');
      }

      console.log(' Received subfields data:', {
        subfieldsCount: data.subfields?.length || 0,
        pagination: data.pagination
      });

      // Handle both new paginated format and legacy format
      const newSubfields = data.subfields || data;
      const pagination = data.pagination || null;
      
      // Cache the results
      setCachedData(currentCacheKey, newSubfields);

      setState(prev => ({
        ...prev,
        subfields: append ? [...prev.subfields, ...newSubfields] : newSubfields,
        loading: false,
        currentPage: page,
        hasMore: pagination ? pagination.hasNextPage : newSubfields.length === pageSize,
        totalCount: pagination ? pagination.totalCount : prev.totalCount,
      }));
      
      console.log(' Updated state with subfields:', newSubfields.length);
    } catch (error) {
      console.error(' Error in loadSubfields:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [pageSize, getCachedData, setCachedData]); // Removed searchQuery from dependencies

  // Load more subfields
  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore) {
      loadSubfields(state.currentPage + 1, true);
    }
  }, [state.loading, state.hasMore, state.currentPage, loadSubfields]);

  // Search subfields
  const search = useCallback((query: string) => {
    console.log(' search function called with query:', query);
    setState(prev => ({
      ...prev,
      subfields: [],
      currentPage: 1,
      hasMore: true,
    }));
    // Trigger the search immediately
    loadSubfields(1, false);
  }, [loadSubfields]);

  // Reset to initial state
  const reset = useCallback(() => {
    setState({
      subfields: [],
      loading: false,
      error: null,
      hasMore: true,
      currentPage: 1,
      totalCount: 0,
    });
  }, []);

  // Load initial data only once on mount
  useEffect(() => {
    loadSubfields(1, false);
  }, []); // Empty dependency array - only run on mount

  // Trigger search when searchQuery changes
  useEffect(() => {
    console.log(' searchQuery changed, triggering search:', searchQueryRef.current);
    if (searchQueryRef.current !== undefined) {
      loadSubfields(1, false);
    }
  }, [searchQuery, loadSubfields]);

  // Filter out already selected subfields and ensure unique IDs
  const availableSubfields = useMemo(() => {
    const selectedIds = new Set(selectedSubfields.map(s => s.id));
    const seenIds = new Set<string>();
    return state.subfields
      .filter(subfield => !selectedIds.has(subfield.id))
      .filter(subfield => {
        if (seenIds.has(subfield.id)) {
          return false;
        }
        seenIds.add(subfield.id);
        return true;
      });
  }, [state.subfields, selectedSubfields]);

  return {
    // State
    subfields: availableSubfields,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    currentPage: state.currentPage,
    totalCount: state.totalCount,
    
    // Actions
    loadMore,
    search,
    reset,
    loadSubfields,
  };
}; 
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

interface Repost {
  id: number;
  userId: string;
  staffPostId: number;
  createdAt: string;
  content?: string;
  type?: "repost";
  staffPost: {
    id: number;
    title: string;
    authors: string[];
    publicationDate: string;
    citedByCount: number;
    abstract: string;
    doi: string;
    linkId: string;
    citation: string;
    subfields: string[];
    createdAt: string;
  };
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
  userFullName?: string;
  likes: number;
  comments: number;
}

interface RepostsSearchState {
  reposts: Repost[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
  totalCount: number;
}

interface UseRepostsSearchOptions {
  pageSize?: number;
  selectedSubfields?: string[];
}

// Simple in-memory cache for reposts
const repostsCache = new Map<string, { data: Repost[]; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const useRepostsSearch = (options: UseRepostsSearchOptions = {}) => {
  const { pageSize = 20, selectedSubfields = [] } = options;
  
  // Use ref to track current selectedSubfields to avoid circular dependency
  const selectedSubfieldsRef = useRef(selectedSubfields);
  selectedSubfieldsRef.current = selectedSubfields;

  const [state, setState] = useState<RepostsSearchState>({
    reposts: [],
    loading: false,
    error: null,
    hasMore: true,
    currentPage: 1,
    totalCount: 0,
  });

  // Generate cache key
  const cacheKey = useMemo(() => {
    const subfieldsKey = selectedSubfields.sort().join(',');
    return `reposts_${pageSize}_${subfieldsKey}_${state.currentPage}`;
  }, [pageSize, selectedSubfields, state.currentPage]);

  // Check cache
  const getCachedData = useCallback((key: string) => {
    const cached = repostsCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }, []);

  // Set cache
  const setCachedData = useCallback((key: string, data: Repost[]) => {
    repostsCache.set(key, { data, timestamp: Date.now() });
  }, []);

  // Load reposts with pagination
  const loadReposts = useCallback(async (page: number = 1, append: boolean = false) => {
    console.log(' loadReposts called with:', { page, append, selectedSubfields: selectedSubfieldsRef.current });
    
    // If no subfields selected, don't load anything
    if (selectedSubfieldsRef.current.length === 0) {
      console.log(' No subfields selected, clearing state');
      setState(prev => ({
        ...prev,
        reposts: [],
        loading: false,
        currentPage: 1,
        hasMore: false,
      }));
      return;
    }

    // Search reposts by subfields using the API
    const searchCacheKey = `search_reposts_${pageSize}_${selectedSubfieldsRef.current.sort().join(',')}_${page}`;
    const cached = getCachedData(searchCacheKey);

    if (cached && !append) {
      console.log(' Using cached data for:', searchCacheKey);
      setState(prev => ({
        ...prev,
        reposts: cached,
        loading: false,
        currentPage: page,
        hasMore: cached.length === pageSize,
      }));
      return;
    }

    console.log(' Fetching reposts from API for subfields:', selectedSubfieldsRef.current);
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // URL encode each subfield name to handle special characters
      const encodedSubfields = selectedSubfieldsRef.current.map((name) =>
        encodeURIComponent(name)
      );

      const url = `/api/reposts/mongodb?subfields=${encodedSubfields.join(",")}&page=${page}&limit=${pageSize}`;
      console.log(' Fetching from URL:', url);
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search reposts');
      }

      console.log(' Received reposts data:', { count: data.reposts?.length || 0, pagination: data.pagination });

      const newReposts = (data.reposts || data).map((repost: Repost) => ({
        ...repost,
        type: "repost" as const, // Add type for FeedCard
      }));
      
      // Cache the results
      setCachedData(searchCacheKey, newReposts);

      setState(prev => ({
        ...prev,
        reposts: append ? [...prev.reposts, ...newReposts] : newReposts,
        loading: false,
        currentPage: page,
        hasMore: data.pagination?.hasMore ?? (newReposts.length === pageSize),
      }));
      
      console.log(' Updated state with reposts:', newReposts.length);
    } catch (error) {
      console.error(' Error fetching reposts:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [pageSize, getCachedData, setCachedData]);

  // Load more reposts
  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore) {
      loadReposts(state.currentPage + 1, true);
    }
  }, [state.loading, state.hasMore, state.currentPage, loadReposts]);

  // Reset to initial state
  const reset = useCallback(() => {
    setState({
      reposts: [],
      loading: false,
      error: null,
      hasMore: true,
      currentPage: 1,
      totalCount: 0,
    });
  }, []);

  // Load initial data when selectedSubfields change
  useEffect(() => {
    // Reset state when subfields change
    setState(prev => ({
      ...prev,
      reposts: [],
      loading: false,
      error: null,
      hasMore: true,
      currentPage: 1,
      totalCount: 0,
    }));
    
    // Only load if subfields are provided
    if (selectedSubfieldsRef.current.length > 0) {
      loadReposts(1, false);
    }
  }, [selectedSubfields.join(','), loadReposts]);

  // Clear cache when subfields change significantly
  useEffect(() => {
    const subfieldsKey = selectedSubfieldsRef.current.sort().join(',');
    const cacheKeysToClear = Array.from(repostsCache.keys()).filter(key => 
      key.includes('search_reposts_') && !key.includes(subfieldsKey)
    );
    cacheKeysToClear.forEach(key => repostsCache.delete(key));
  }, [selectedSubfields]);

  return {
    // State
    reposts: state.reposts,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    currentPage: state.currentPage,
    totalCount: state.totalCount,

    // Actions
    loadMore,
    reset,
    loadReposts,
  };
}; 
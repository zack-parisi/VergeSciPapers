import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { StaffPost } from '../../forum_feed_page/staffPostApi';

interface PostsSearchState {
  posts: StaffPost[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
  totalCount: number;
}

interface UsePostsSearchOptions {
  pageSize?: number;
  selectedSubfields?: string[];
}

// Simple in-memory cache for posts
const postsCache = new Map<string, { data: StaffPost[]; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes (shorter than subfields since posts change more frequently)

export const usePostsSearch = (options: UsePostsSearchOptions = {}) => {
  const { pageSize = 30, selectedSubfields = [] } = options;
  
  // Use ref to track current selectedSubfields to avoid circular dependency
  const selectedSubfieldsRef = useRef(selectedSubfields);
  selectedSubfieldsRef.current = selectedSubfields;

  const [state, setState] = useState<PostsSearchState>({
    posts: [],
    loading: false,
    error: null,
    hasMore: true,
    currentPage: 1,
    totalCount: 0,
  });

  // Generate cache key
  const cacheKey = useMemo(() => {
    const subfieldsKey = selectedSubfields.sort().join(',');
    return `posts_${pageSize}_${subfieldsKey}_${state.currentPage}`;
  }, [pageSize, selectedSubfields, state.currentPage]);

  // Check cache
  const getCachedData = useCallback((key: string) => {
    const cached = postsCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }, []);

  // Set cache
  const setCachedData = useCallback((key: string, data: StaffPost[]) => {
    postsCache.set(key, { data, timestamp: Date.now() });
  }, []);

  // Load posts with pagination
  const loadPosts = useCallback(async (page: number = 1, append: boolean = false) => {
    // Always use the search API, which handles both cases (with and without subfields)
    const searchCacheKey = selectedSubfieldsRef.current.length === 0 
      ? `search_posts_no_subfields_${pageSize}_${page}`
      : `search_posts_${pageSize}_${selectedSubfieldsRef.current.sort().join(',')}_${page}`;
    
    const cached = getCachedData(searchCacheKey);

    if (cached && !append) {
      setState(prev => ({
        ...prev,
        posts: cached,
        loading: false,
        currentPage: page,
        hasMore: cached.length === pageSize,
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // URL encode each subfield name to handle special characters
      const encodedSubfields = selectedSubfieldsRef.current.map((name) =>
        encodeURIComponent(name)
      );

      const url = `/api/search/posts?subfields=${encodedSubfields.join(",")}&page=${page}&limit=${pageSize}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search posts');
      }

      const newPosts = data.posts || data;
      
      // Cache the results
      setCachedData(searchCacheKey, newPosts);

      setState(prev => ({
        ...prev,
        posts: append ? [...prev.posts, ...newPosts] : newPosts,
        loading: false,
        currentPage: page,
        hasMore: newPosts.length === pageSize,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [pageSize, getCachedData, setCachedData]);

  // Load more posts
  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore) {
      loadPosts(state.currentPage + 1, true);
    }
  }, [state.loading, state.hasMore, state.currentPage, loadPosts]);

  // Search posts
  const search = useCallback((subfields: string[]) => {
    setState(prev => ({
      ...prev,
      posts: [],
      currentPage: 1,
      hasMore: true,
    }));
    // The actual search will be triggered by the useEffect below
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    setState({
      posts: [],
      loading: false,
      error: null,
      hasMore: true,
      currentPage: 1,
      totalCount: 0,
    });
  }, []);

  // Load initial data when selectedSubfields change
  useEffect(() => {
    loadPosts(1, false);
  }, [selectedSubfields.join(','), loadPosts]);

  // Clear cache when subfields change significantly
  useEffect(() => {
    const subfieldsKey = selectedSubfieldsRef.current.sort().join(',');
    const cacheKeysToClear = Array.from(postsCache.keys()).filter(key => 
      key.includes('search_posts_') && !key.includes(subfieldsKey)
    );
    cacheKeysToClear.forEach(key => postsCache.delete(key));
  }, [selectedSubfields]);

  return {
    // State
    posts: state.posts,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    currentPage: state.currentPage,
    totalCount: state.totalCount,

    // Actions
    loadMore,
    search,
    reset,
    loadPosts,
  };
}; 
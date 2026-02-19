import { useState, useEffect, useCallback, useRef } from 'react';

export interface SearchPost {
  id: string;
  title: string;
  abstract?: string;
  description?: string;
  authors?: Array<{ display_name?: string; given_name?: string; family_name?: string; }>;
  publication_date?: string;
  cited_by_count?: number;
  relevance_score?: number;
  subfields?: string[];
  doi?: string;
  open_access?: { is_oa?: boolean; oa_url?: string; };
  type?: 'staff' | 'paper';
  isLiked?: boolean;
  likesCount?: number;
  commentsCount?: number;
  isBookmarked?: boolean;
  isReposted?: boolean;
  repostsCount?: number;
}

interface UseSearchPostsOptions {
  limit?: number;
  autoFetch?: boolean;
}

interface UseSearchPostsReturn {
  posts: SearchPost[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  fetchPosts: (searchType: string, searchValue: string, subfields?: string[]) => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

export function useSearchPosts(options: UseSearchPostsOptions = {}): UseSearchPostsReturn {
  const { limit = 30, autoFetch = false } = options;
  
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Keep track of current search parameters
  const currentSearchRef = useRef<{
    searchType: string;
    searchValue: string;
    subfields: string[];
  } | null>(null);

  const fetchPosts = useCallback(async (
    searchType: string,
    searchValue: string,
    subfields: string[] = []
  ) => {
    // Update current search parameters
    currentSearchRef.current = { searchType, searchValue, subfields };
    
    setLoading(true);
    setError(null);
    setCurrentPage(1);
    
    try {
      const params = new URLSearchParams({
        searchType,
        page: '1',
        limit: limit.toString()
      });

      if (searchType === 'topics' && subfields.length > 0) {
        params.append('subfields', subfields.join(','));
      } else if (searchType === 'authors' && searchValue.trim()) {
        params.append('searchQuery', searchValue.trim());
      } else if (searchType === 'title' && searchValue.trim()) {
        params.append('searchQuery', searchValue.trim());
      }

      console.log(' useSearchPosts: Fetching with params:', Object.fromEntries(params));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`/api/search/posts?${params}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const newPosts = data.posts || [];
      setPosts(newPosts);
      setTotalCount(data.totalCount || 0);
      setHasMore(newPosts.length === limit);
      
      console.log(' useSearchPosts: Fetched', newPosts.length, 'posts, total:', data.totalCount);
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(' useSearchPosts: Request timeout');
        setError('Search timeout - please try again with more specific terms');
      } else {
        console.error(' useSearchPosts: Fetch error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
      setPosts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const loadMore = useCallback(async () => {
    if (!currentSearchRef.current || loading || !hasMore) return;
    
    setLoading(true);
    
    try {
      const { searchType, searchValue, subfields } = currentSearchRef.current;
      const nextPage = currentPage + 1;
      
      const params = new URLSearchParams({
        searchType,
        page: nextPage.toString(),
        limit: limit.toString()
      });

      if (searchType === 'topics' && subfields.length > 0) {
        params.append('subfields', subfields.join(','));
      } else if (searchType === 'authors' && searchValue.trim()) {
        params.append('searchQuery', searchValue.trim());
      } else if (searchType === 'title' && searchValue.trim()) {
        params.append('searchQuery', searchValue.trim());
      }

      const response = await fetch(`/api/search/posts?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const newPosts = data.posts || [];
      setPosts(prev => [...prev, ...newPosts]);
      setCurrentPage(nextPage);
      setHasMore(newPosts.length === limit);
      
      console.log(' useSearchPosts: Loaded', newPosts.length, 'more posts');
      
    } catch (err) {
      console.error(' useSearchPosts: Load more error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred loading more posts');
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, loading, hasMore]);

  const reset = useCallback(() => {
    setPosts([]);
    setLoading(false);
    setError(null);
    setHasMore(true);
    setTotalCount(0);
    setCurrentPage(1);
    currentSearchRef.current = null;
  }, []);

  return {
    posts,
    loading,
    error,
    hasMore,
    totalCount,
    fetchPosts,
    loadMore,
    reset
  };
} 
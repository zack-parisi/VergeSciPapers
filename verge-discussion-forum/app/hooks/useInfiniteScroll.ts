import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  threshold?: number; // Distance from bottom to trigger load (default: 100px)
  rootMargin?: string; // CSS margin for intersection observer
}

export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  loading,
  threshold = 100,
  rootMargin = '0px'
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    console.log(' Intersection observed:', {
      isIntersecting: entry.isIntersecting,
      hasMore,
      loading,
      threshold: threshold
    });
    
    if (entry.isIntersecting && hasMore && !loading) {
      console.log(' Infinite scroll triggered - loading more content');
      onLoadMore();
    } else {
      console.log(' Intersection conditions not met:', {
        isIntersecting: entry.isIntersecting,
        hasMore,
        loading
      });
    }
  }, [onLoadMore, hasMore, loading, threshold]);

  useEffect(() => {
    console.log(' Setting up intersection observer:', {
      hasMore,
      loading,
      threshold
    });

    if (loading) {
      console.log(' Skipping observer setup - currently loading');
      return;
    }

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin: `${threshold}px ${rootMargin}`,
      threshold: 0.1
    });

    // Observe the loading element
    if (loadingRef.current) {
      console.log(' Observing loading element');
      observerRef.current.observe(loadingRef.current);
    } else {
      console.log(' Loading element ref is null');
    }

    // Cleanup function
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, loading, threshold, rootMargin, hasMore]);

  return loadingRef;
}

// Alternative hook for scroll-based infinite scroll (fallback)
export function useScrollInfiniteScroll({
  onLoadMore,
  hasMore,
  loading,
  threshold = 200
}: UseInfiniteScrollOptions) {
  const handleScroll = useCallback(() => {
    if (loading || !hasMore) return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    if (scrollTop + windowHeight >= documentHeight - threshold) {
      console.log(' Scroll-based infinite scroll triggered');
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loading, threshold]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
} 
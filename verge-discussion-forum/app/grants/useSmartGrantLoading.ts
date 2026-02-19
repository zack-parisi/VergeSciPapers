import { useState, useEffect, useCallback } from 'react';
import { 
  Grant, 
  fetchGrantsWithSubfields,
  PaginatedResponse,
  SmartLoadResponse 
} from './grantApi';

interface UseSmartGrantLoadingProps {
  targetGrantId?: number;
  initialPage?: number;
  grantsPerPage?: number;
}

interface UseSmartGrantLoadingReturn {
  grants: Grant[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    totalGrants: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  } | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  targetGrantIndex: number | null;
}

export const useSmartGrantLoading = ({
  targetGrantId,
  initialPage = 1,
  grantsPerPage = 20
}: UseSmartGrantLoadingProps): UseSmartGrantLoadingReturn => {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [targetGrantIndex, setTargetGrantIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);

  const loadGrants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all grants with subfields in one call
      const data = await fetchGrantsWithSubfields(currentPage, grantsPerPage);
      const fetchedGrants = data.grants || [];
      if (currentPage === 1) {
        setGrants(fetchedGrants);
      } else {
        setGrants(prev => [...prev, ...fetchedGrants]);
      }
      setPagination(data.pagination || null);
      setTargetGrantIndex(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load grants');
    } finally {
      setLoading(false);
    }
  }, [currentPage, grantsPerPage]);

  const loadMore = useCallback(async () => {
    if (targetGrantId || !pagination?.hasNextPage || loading) return;
    setCurrentPage(prev => prev + 1);
  }, [targetGrantId, pagination?.hasNextPage, loading]);

  const refresh = useCallback(async () => {
    setCurrentPage(initialPage);
    await loadGrants();
  }, [loadGrants, initialPage]);

  useEffect(() => {
    loadGrants();
  }, [loadGrants]);

  return {
    grants,
    loading,
    error,
    pagination,
    loadMore,
    refresh,
    targetGrantIndex
  };
}; 
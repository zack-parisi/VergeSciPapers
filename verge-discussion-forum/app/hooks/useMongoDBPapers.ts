import { useState, useEffect, useCallback, useRef } from 'react';
import { StaffPostFormat } from '../../lib/mongodb-helpers';
import { sortPapersByAlgorithm, PaperAlgorithmType } from '../../lib/paper-algorithms';

interface UseMongoDBPapersOptions {
  page?: number;
  limit?: number;
  minRelevance?: number;
  minCitations?: number;
  year?: string;
  subfields?: string[]; // Changed from subfield to subfields array
  journals?: string[]; // New: journal filtering
  searchQuery?: string;
  algorithm?: 'seminal' | 'relevance';
  autoFetch?: boolean;
  enableTiered?: boolean; // New: Enable tiered queries for universal coverage
  enableInfiniteScroll?: boolean; // New: Enable infinite scroll
  yearRangeStart?: number; // New: inclusive start year for range filter
  yearRangeEnd?: number;   // New: inclusive end year for range filter
}

interface UseMongoDBPapersReturn {
  papers: StaffPostFormat[];
  loading: boolean;
  loadingMore: boolean; // New: Separate loading state for infinite scroll
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null;
  filters: {
    minRelevance: number;
    minCitations: number;
    year?: string;
    subfields?: string[]; // Changed from subfield to subfields array
    journals?: string[]; // New: journal filtering
    searchQuery?: string;
    algorithm?: 'seminal' | 'relevance';
    enableTiered?: boolean;
    yearRangeStart?: number; // New
    yearRangeEnd?: number;   // New
  } | null;
  fetchPapers: (options?: Partial<UseMongoDBPapersOptions>) => Promise<void>;
  loadMore: () => Promise<void>; // New: Load more papers for infinite scroll
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setMinRelevance: (minRelevance: number) => void;
  setMinCitations: (minCitations: number) => void;
  setYear: (year: string) => void;
  setYearRange: (range: [number, number]) => void; // New: set inclusive year range
  setSubfields: (subfields: string[]) => void; // Changed from setSubfield to setSubfields
  setJournals: (journals: string[]) => void; // New: Set journals filter
  setSearchQuery: (searchQuery: string) => void;
  setAlgorithm: (algorithm: 'seminal' | 'relevance') => void;
  setEnableTiered: (enableTiered: boolean) => void; // New: Toggle tiered queries
  resetFilters: () => void;
  hasMore: boolean; // New: Whether there are more papers to load
  nextCursor?: string; // New: Cursor for infinite scroll pagination
}

export function useMongoDBPapers(initialOptions: UseMongoDBPapersOptions = {}): UseMongoDBPapersReturn {
  
function filterByClientCriteria(papers: any[], opts: { year?: string; minCitations?: number; yearRangeStart?: number; yearRangeEnd?: number }) {
  const year = opts.year;
  const minCitations = typeof opts.minCitations === 'number' ? opts.minCitations : 0;
  const rangeStart = typeof opts.yearRangeStart === 'number' ? opts.yearRangeStart : undefined;
  const rangeEnd = typeof opts.yearRangeEnd === 'number' ? opts.yearRangeEnd : undefined;
  const filtered = papers.filter((p: any) => {
    const okCitations = minCitations > 0 ? (Number(p.citedByCount ?? p.cited_by_count ?? 0) >= minCitations) : true;
    let okYear = true;
    const pd = p.publicationDate ?? p.publication_date ?? '';
    const yStr = typeof pd === 'string' ? pd.slice(0,4) : (typeof pd === 'number' ? String(pd) : '');
    const yNum = yStr ? Number(yStr) : NaN;
    if (year) {
      okYear = yStr === year;
    } else if (rangeStart !== undefined && rangeEnd !== undefined && !Number.isNaN(yNum)) {
      okYear = yNum >= rangeStart && yNum <= rangeEnd;
    }
    return okCitations && okYear;
  });
  return filtered;
}

  const [papers, setPapers] = useState<StaffPostFormat[]>([]);
  const [rawPapers, setRawPapers] = useState<StaffPostFormat[]>([]); // Store raw papers from API
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false); // New: Separate loading state
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [filters, setFilters] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true); // New: Track if more papers are available
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined); // New: Cursor for pagination
  
  // State for current options
  const [options, setOptions] = useState<UseMongoDBPapersOptions>({
    page: 1,
    limit: 20,
    minRelevance: 0.0,
    minCitations: 0,
    journals: [],
    algorithm: 'relevance',
    autoFetch: true,
    enableTiered: true, // Default to tiered approach for universal coverage
    enableInfiniteScroll: true, // Default to infinite scroll
    ...initialOptions
  });

  // Use ref to access current options without causing infinite loops
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Use ref to track if we should fetch to prevent infinite loops
  const shouldFetchRef = useRef(false);

  const fetchPapers = useCallback(async (overrideOptions?: Partial<UseMongoDBPapersOptions>) => {
    const updatedOptions = { ...optionsRef.current, ...overrideOptions };
    
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('limit', (updatedOptions.limit || 10).toString());
      params.append('page', (updatedOptions.page || 1).toString());
      params.append('minRelevance', (updatedOptions.minRelevance || 0.0).toString());
      params.append('algorithm', updatedOptions.algorithm || 'relevance');
      params.append('enableTiered', (updatedOptions.enableTiered || false).toString());
      
      if (updatedOptions.year) {
        params.append('year', updatedOptions.year);
      }
      
      if (updatedOptions.minCitations !== undefined) {
        params.append('minCitations', updatedOptions.minCitations.toString());
      }

      if (updatedOptions.subfields && updatedOptions.subfields.length > 0) {
        params.append('subfields', updatedOptions.subfields.join(','));
      }

      if (updatedOptions.journals && updatedOptions.journals.length > 0) {
        params.append('journals', updatedOptions.journals.join(','));
      }

      if (!updatedOptions.year && typeof updatedOptions.yearRangeStart === 'number' && typeof updatedOptions.yearRangeEnd === 'number') {
        params.append('yearRangeStart', String(updatedOptions.yearRangeStart));
        params.append('yearRangeEnd', String(updatedOptions.yearRangeEnd));
      }

      // Try MongoDB first, then fallback to fast API
      let url = `/api/papers/mongodb/fast?${params}`;
      
      let response = await fetch(url);
      let data = await response.json();

      // If MongoDB fails, try fast API (but never for subfield or journal-filtered searches)
      const hasSubfields = !!(updatedOptions.subfields && updatedOptions.subfields.length > 0);
      const hasJournals = !!(updatedOptions.journals && updatedOptions.journals.length > 0);
      if (!response.ok || data.error) {
        if (!hasSubfields && !hasJournals) {
          console.log(' MongoDB papers API failed without subfields, using simple MongoDB API...');
          const simpleUrl = `/api/papers/mongodb/simple?limit=${encodeURIComponent(String(updatedOptions.limit || 10))}&algorithm=${encodeURIComponent(updatedOptions.algorithm || 'relevance')}`;
          response = await fetch(simpleUrl);
          data = await response.json();
        } else {
          throw new Error(data?.error || 'MongoDB papers API failed');
        }
      } else if (!hasSubfields && !hasJournals && (data.papers?.length === 0)) {
        console.log(' MongoDB papers API returned empty without subfields, using simple MongoDB API...');
        const simpleUrl = `/api/papers/mongodb/simple?limit=${encodeURIComponent(String(updatedOptions.limit || 10))}&algorithm=${encodeURIComponent(updatedOptions.algorithm || 'relevance')}`;
        response = await fetch(simpleUrl);
        data = await response.json();
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch papers');
      }

      let transformedPapers = data.papers || [];
      
      // For initial load, replace papers; for infinite scroll, append
      if (updatedOptions.page === 1 || !updatedOptions.enableInfiniteScroll) {
        setRawPapers(transformedPapers);
        setPapers(transformedPapers);
      } else {
        setRawPapers(prev => [...prev, ...transformedPapers]);
        setPapers(prev => [...prev, ...transformedPapers]);
      }
      
      setPagination(data.pagination || null);
      setFilters(data.filters || {});
      setHasMore(data.hasMore || false);
      setNextCursor(data.nextCursor);
      // Persist applied filters into options for subsequent loadMore calls
      setOptions(prev => ({
        ...prev,
        page: updatedOptions.page || prev.page,
        minCitations: updatedOptions.minCitations ?? prev.minCitations,
        year: updatedOptions.year ?? prev.year,
        // @ts-ignore allow extended props
        yearRangeStart: (updatedOptions as any).yearRangeStart ?? (prev as any).yearRangeStart,
        // @ts-ignore allow extended props
        yearRangeEnd: (updatedOptions as any).yearRangeEnd ?? (prev as any).yearRangeEnd,
        subfields: updatedOptions.subfields ?? prev.subfields,
        algorithm: updatedOptions.algorithm ?? prev.algorithm,
      }));
    } catch (error) {
      console.error(' Error fetching papers:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []); // Remove options dependency to prevent infinite loops

  // New: Load more papers for infinite scroll
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return;
    }
    
    setLoadingMore(true);
    setError(null);

    try {
      const currentPage = optionsRef.current.page || 1;
      const nextPage = currentPage + 1;
      
      const params = new URLSearchParams();
      params.append('limit', (optionsRef.current.limit || 10).toString());
      params.append('page', nextPage.toString());
      params.append('algorithm', optionsRef.current.algorithm || 'relevance');
      params.append('enableTiered', (optionsRef.current.enableTiered || false).toString());
      
      if (optionsRef.current.year) {
        params.append('year', optionsRef.current.year);
      }
      
      if (optionsRef.current.minCitations !== undefined) {
        params.append('minCitations', optionsRef.current.minCitations.toString());
      }

      if (optionsRef.current.subfields && optionsRef.current.subfields.length > 0) {
        params.append('subfields', optionsRef.current.subfields.join(','));
      }

      if (optionsRef.current.journals && optionsRef.current.journals.length > 0) {
        params.append('journals', optionsRef.current.journals.join(','));
      }

      if (!optionsRef.current.year && typeof optionsRef.current.yearRangeStart === 'number' && typeof optionsRef.current.yearRangeEnd === 'number') {
        params.append('yearRangeStart', String(optionsRef.current.yearRangeStart));
        params.append('yearRangeEnd', String(optionsRef.current.yearRangeEnd));
      }

      const url = `/api/papers/mongodb/fast?${params}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load more papers');
      }

      let newPapers = (data.papers || []);
      
      // Batch state updates to prevent multiple re-renders
      setRawPapers(prev => {
        const updated = [...prev, ...newPapers];
        return updated;
      });
      
      setPapers(prev => {
        const updated = [...prev, ...newPapers];
        return updated;
      });
      
      // Update pagination state
      setHasMore(data.hasMore || false);
      setNextCursor(data.nextCursor);
      setOptions(prev => ({ ...prev, page: nextPage }));
      
    } catch (error) {
      console.error(' Error loading more papers:', error);
      setError(error instanceof Error ? error.message : 'Failed to load more papers');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore]);

  // Re-sort papers when algorithm changes (without refetching)
  useEffect(() => {
    if (rawPapers.length > 0 && options.algorithm) {
      const sortedPapers = sortPapersByAlgorithm(rawPapers, options.algorithm as PaperAlgorithmType);
      setPapers(sortedPapers);
    }
  }, [rawPapers, options.algorithm]);

  // Fetch papers when subfields change
  useEffect(() => {
    if (shouldFetchRef.current && options.subfields && options.subfields.length > 0) {
      shouldFetchRef.current = false; // Reset flag
      fetchPapers({ subfields: options.subfields, page: 1 });
    }
  }, [options.subfields]); // Remove fetchPapers dependency

  // Fetch papers when journals change
  useEffect(() => {
    if (shouldFetchRef.current && options.journals && options.journals.length > 0) {
      shouldFetchRef.current = false; // Reset flag
      fetchPapers({ journals: options.journals, page: 1 });
    }
  }, [options.journals]); // Remove fetchPapers dependency

  // Auto-fetch on mount only - disabled to prevent conflicts
  // useEffect(() => {
  //   if (options.autoFetch) {
  //     fetchPapers();
  //   }
  // }, []); // Only run on mount

  // Helper functions to update specific options
  const setPage = useCallback((page: number) => {
    setOptions(prev => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setOptions(prev => ({ ...prev, limit, page: 1 })); // Reset to first page when changing limit
  }, []);

  const setMinRelevance = useCallback((minRelevance: number) => {
    setOptions(prev => ({ ...prev, minRelevance, page: 1 }));
  }, []);

  const setMinCitations = useCallback((minCitations: number) => {
    setOptions(prev => ({ ...prev, minCitations, page: 1 }));
  }, []);

  const setYear = useCallback((year: string) => {
    setOptions(prev => ({ ...prev, year, page: 1 }));
  }, []);

  const setYearRange = useCallback((range: [number, number]) => {
    setOptions(prev => ({ ...prev, yearRangeStart: range[0], yearRangeEnd: range[1], page: 1 }));
  }, []);

  const setSubfields = useCallback((subfields: string[]) => {
    // Clear posts immediately to prevent flickering
    setPapers([]);
    setRawPapers([]);
    setOptions(prev => ({ ...prev, subfields, page: 1 }));
    // Set flag to trigger fetch
    shouldFetchRef.current = true;
  }, []); // Remove fetchPapers dependency

  const setJournals = useCallback((journals: string[]) => {
    // Clear posts immediately to prevent flickering
    setPapers([]);
    setRawPapers([]);
    setOptions(prev => ({ ...prev, journals, page: 1 }));
    // Set flag to trigger fetch
    shouldFetchRef.current = true;
  }, []); // Remove fetchPapers dependency

  const setSearchQuery = useCallback((searchQuery: string) => {
    setOptions(prev => ({ ...prev, searchQuery, page: 1 }));
  }, []);

  const setAlgorithm = useCallback((algorithm: 'seminal' | 'relevance') => {
    setOptions(prev => ({ ...prev, algorithm, page: 1 }));
  }, []);

  const setEnableTiered = useCallback((enableTiered: boolean) => {
    setPapers([]);
    setRawPapers([]);
    setOptions(prev => ({ ...prev, enableTiered, page: 1 }));
    // Trigger fetch with new tiered setting
    fetchPapers({ enableTiered, page: 1 });
  }, [fetchPapers]);

  const resetFilters = useCallback(() => {
    setOptions(prev => ({
      ...prev,
      page: 1,
      minRelevance: 0.0,
      minCitations: 0,
      year: undefined,
      subfields: undefined,
      journals: undefined,
      searchQuery: undefined,
      algorithm: 'relevance',
      enableTiered: true, // Keep tiered enabled by default
      yearRangeStart: undefined,
      yearRangeEnd: undefined,
    }));
  }, []);

  return {
    papers,
    loading,
    loadingMore,
    error,
    pagination,
    filters,
    fetchPapers,
    loadMore,
    setPage,
    setLimit,
    setMinRelevance,
    setMinCitations,
    setYear,
    setYearRange,
    setSubfields,
    setJournals,
    setSearchQuery,
    setAlgorithm,
    setEnableTiered,
    resetFilters,
    hasMore,
    nextCursor
  };
}

// Hook for fetching papers by IDs
export function useMongoDBPapersByIds() {
  const [papers, setPapers] = useState<StaffPostFormat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPapersByIds = useCallback(async (paperIds: string[]) => {
    if (!paperIds || paperIds.length === 0) {
      setPapers([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/papers/mongodb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paperIds }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setPapers(data.papers);
      } else {
        throw new Error(data.error || 'Failed to fetch papers');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setPapers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    papers,
    loading,
    error,
    fetchPapersByIds
  };
} 
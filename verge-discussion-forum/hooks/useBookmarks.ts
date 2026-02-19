import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface UseBookmarksProps {
  targetId: string;
  targetType: 'staff_post' | 'mongodb_paper' | 'grant' | 'repost' | 'post' | 'eureka_result';
  initialBookmarkCount?: number;
  initialBookmarked?: boolean;
  onBookmarkClick?: () => void; // Callback for opening modal
  onUnbookmarkClick?: () => void; // NEW: Callback for unbookmark confirmation
  completePaperData?: any; // NEW: Complete paper data to store in bookmark
  postId?: string; // NEW: Post ID for reposts and regular posts
  skipInitialFetch?: boolean; // New: allow caller to disable the initial fetch
}

interface BookmarkStatus {
  bookmarkCount: number;
  bookmarked: boolean;
}

export function useBookmarks({ 
  targetId, 
  targetType, 
  initialBookmarkCount = 0, 
  initialBookmarked = false,
  onBookmarkClick,
  onUnbookmarkClick, // NEW: Accept unbookmark confirmation callback
  completePaperData, // NEW: Accept complete paper data
  postId, // NEW: Accept post ID
  skipInitialFetch = false
}: UseBookmarksProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [bookmarkCount, setBookmarkCount] = useState(initialBookmarkCount);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to refresh bookmark status from server
  const refreshBookmarkStatus = useCallback(async () => {
    if (!targetId || !targetType) return;

    try {
      const params = new URLSearchParams({
        targetId,
        targetType,
        ...(session?.userId && { userId: session.userId })
      });

      const response = await fetch(`/api/mongodb/bookmarks?${params}`);
      if (response.ok) {
        const data: BookmarkStatus = await response.json();
        setBookmarkCount(data.bookmarkCount || 0);
        setBookmarked(data.bookmarked || false);
      }
    } catch (err) {
      console.error('Error refreshing bookmark status:', err);
      // Set safe defaults on error
      setBookmarkCount(0);
      setBookmarked(false);
    }
  }, [targetId, targetType, session?.userId]);

  // Fetch initial bookmark status only if we don't have initial bookmarked state
  useEffect(() => {
    // Only refresh from server if we don't have a definitive initial state
    // This prevents overriding the bookmarked=true state when we're in saved content
    if (skipInitialFetch) return; // Respect opt-out to reduce network chatter
    if (!initialBookmarked) {
      refreshBookmarkStatus();
    }
  }, [refreshBookmarkStatus, initialBookmarked, skipInitialFetch]);

  // Listen for bookmark changes from other parts of the app
  useEffect(() => {
    const handleBookmarkChange = (event: CustomEvent) => {
      const { targetId: changedTargetId, targetType: changedTargetType, bookmarked: newBookmarked } = event.detail;
      
      // Only update if this bookmark matches our target
      if (changedTargetId === targetId && changedTargetType === targetType) {
        console.log(" Bookmark state changed externally, updating local state:", { targetId, newBookmarked });
        setBookmarked(newBookmarked);
        setBookmarkCount(prev => newBookmarked ? prev + 1 : Math.max(0, prev - 1));
      }
    };

    // Listen for custom bookmark change events
    window.addEventListener('bookmarkChanged', handleBookmarkChange as EventListener);
    
    return () => {
      window.removeEventListener('bookmarkChanged', handleBookmarkChange as EventListener);
    };
  }, [targetId, targetType]);

  // Handle bookmark/unbookmark with authentication check and performance monitoring
  const toggleBookmark = useCallback(async () => {
    console.log("toggleBookmark called:", { 
      status, 
      sessionUserId: session?.userId,
      targetId,
      targetType,
      bookmarked,
      hasCompleteData: !!completePaperData
    });
    
    // Check authentication
    if (status === 'loading') {
      console.log("Status is loading, returning");
      return;
    }
    
    if (status !== 'authenticated' || !session?.userId) {
      console.log("Not authenticated, redirecting to login");
      router.push('/login');
      return;
    }

    console.log("Starting bookmark toggle...");
    setLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      const method = bookmarked ? 'DELETE' : 'POST';
      
      // Include complete paper data and postId in the request if available
      const requestBody = bookmarked ? 
        { userId: session.userId, targetId, targetType } :
        { 
          userId: session.userId, 
          targetId, 
          targetType,
          completePaperData, // NEW: Pass complete paper data to API
          postId // NEW: Pass post ID to API
        };

      const body = JSON.stringify(requestBody);

      console.log("Making API call:", { 
        method, 
        body, 
        url: '/api/mongodb/bookmarks',
        hasCompleteData: !!completePaperData,
        requestBody // Log the actual request body
      });

      const response = await fetch('/api/mongodb/bookmarks', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log("API response:", { 
        ok: response.ok, 
        status: response.status, 
        responseTime: `${responseTime}ms` 
      });
      
      if (response.ok) {
        console.log("API call successful, updating state");
        const newBookmarkedState = !bookmarked;
        
        if (bookmarked) {
          // Unbookmark
          console.log("Unbookmarking...");
          setBookmarked(false);
          setBookmarkCount(prev => Math.max(0, prev - 1));
        } else {
          // Bookmark
          console.log("Bookmarking...");
          setBookmarked(true);
          setBookmarkCount(prev => prev + 1);
        }

        // Dispatch custom event to notify other bookmark buttons of the change
        const bookmarkChangeEvent = new CustomEvent('bookmarkChanged', {
          detail: {
            targetId,
            targetType,
            bookmarked: newBookmarkedState
          }
        });
        window.dispatchEvent(bookmarkChangeEvent);

        // Log performance metrics
        if (responseTime > 1000) {
          console.warn(` Slow bookmark operation: ${responseTime}ms`);
        } else {
          console.log(` Fast bookmark operation: ${responseTime}ms`);
        }
      } else {
        const errorData = await response.json();
        console.log("API call failed:", errorData);
        setError(errorData.error || 'Failed to update bookmark');
        
        // Revert optimistic update
        if (bookmarked) {
          setBookmarked(false);
          setBookmarkCount(prev => prev + 1);
        } else {
          setBookmarked(true);
          setBookmarkCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Error toggling bookmark:', err);
      setError('Network error');
      
      // Revert optimistic update
      if (bookmarked) {
        setBookmarked(false);
        setBookmarkCount(prev => prev + 1);
      } else {
        setBookmarked(true);
        setBookmarkCount(prev => Math.max(0, prev - 1));
      }
    } finally {
      setLoading(false);
    }
  }, [bookmarked, session?.userId, targetId, targetType, status, router, completePaperData]);

  // Handle bookmark click with authentication check and modal support
  const handleBookmarkClick = useCallback(() => {
    console.log("handleBookmarkClick called:", { 
      status, 
      bookmarked, 
      hasOnBookmarkClick: !!onBookmarkClick,
      targetId,
      targetType,
      hasCompleteData: !!completePaperData
    });
    
    if (status === 'loading') {
      console.log("Status is loading, returning");
      return;
    }
    
    if (status !== 'authenticated' || !session?.userId) {
      console.log("Not authenticated, redirecting to login");
      router.push('/login');
      return;
    }

    // If not bookmarked, show modal (if provided)
    if (!bookmarked && onBookmarkClick) {
      console.log("Not bookmarked, calling onBookmarkClick");
      onBookmarkClick();
      return;
    }

    // If already bookmarked, show confirmation dialog (if provided) or unbookmark directly
    if (bookmarked) {
      if (onUnbookmarkClick) {
        console.log("Already bookmarked, calling onUnbookmarkClick for confirmation");
        onUnbookmarkClick();
      } else {
        console.log("Already bookmarked, calling toggleBookmark directly");
        toggleBookmark();
      }
    }
  }, [bookmarked, onBookmarkClick, onUnbookmarkClick, toggleBookmark, status, session?.userId, router, targetId, targetType, completePaperData]);

  // Direct bookmark/unbookmark without modal
  const handleDirectBookmark = useCallback(() => {
    if (status === 'loading') return;
    
    if (status !== 'authenticated' || !session?.userId) {
      router.push('/login');
      return;
    }

    toggleBookmark();
  }, [toggleBookmark, status, session?.userId, router]);

  return {
    bookmarkCount,
    bookmarked,
    loading,
    error,
    toggleBookmark,
    handleBookmarkClick,
    handleDirectBookmark,
    refreshBookmarkStatus,
    isAuthenticated: status === 'authenticated'
  };
} 
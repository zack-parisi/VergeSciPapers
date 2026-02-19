import { useBookmarks } from './useBookmarks';
import { useUnbookmarkConfirmation } from '../app/contexts/UnbookmarkContext';
import { useCallback } from 'react';

interface UseBookmarksWithConfirmationProps {
  targetId: string;
  targetType: 'staff_post' | 'mongodb_paper' | 'grant' | 'repost' | 'post';
  initialBookmarkCount?: number;
  initialBookmarked?: boolean;
  onBookmarkClick?: () => void;
  completePaperData?: any;
  postId?: string;
  skipInitialFetch?: boolean;
  itemTitle?: string; // NEW: Title for the confirmation dialog
  itemType?: string; // NEW: Type for the confirmation dialog
}

export function useBookmarksWithConfirmation({
  targetId,
  targetType,
  initialBookmarkCount = 0,
  initialBookmarked = false,
  onBookmarkClick,
  completePaperData,
  postId,
  skipInitialFetch = false,
  itemTitle = "Unknown Item",
  itemType = "item"
}: UseBookmarksWithConfirmationProps) {
  const { showUnbookmarkConfirmation } = useUnbookmarkConfirmation();
  
  // Create a custom unbookmark confirmation handler first
  const handleUnbookmarkConfirmation = useCallback(() => {
    console.log(" handleUnbookmarkConfirmation called:", { targetId, itemTitle, itemType });
    showUnbookmarkConfirmation({
      id: targetId,
      title: itemTitle,
      type: itemType,
      onConfirm: async () => {
        console.log(" Confirmation confirmed, calling toggleBookmark");
        // We'll get toggleBookmark from the useBookmarks hook
        // For now, we'll handle this differently
      }
    });
  }, [showUnbookmarkConfirmation, targetId, itemTitle, itemType]);

  const {
    bookmarkCount,
    bookmarked,
    loading,
    error,
    toggleBookmark,
    handleBookmarkClick: originalHandleBookmarkClick,
    handleDirectBookmark,
    refreshBookmarkStatus
  } = useBookmarks({
    targetId,
    targetType,
    initialBookmarkCount,
    initialBookmarked,
    onBookmarkClick,
    onUnbookmarkClick: handleUnbookmarkConfirmation, // NEW: Pass the confirmation handler
    completePaperData,
    postId,
    skipInitialFetch
  });

  // Update the confirmation handler to use the actual toggleBookmark function
  const updatedHandleUnbookmarkConfirmation = useCallback(() => {
    console.log(" Updated handleUnbookmarkConfirmation called:", { targetId, itemTitle, itemType });
    showUnbookmarkConfirmation({
      id: targetId,
      title: itemTitle,
      type: itemType,
      onConfirm: async () => {
        console.log(" Confirmation confirmed, calling toggleBookmark");
        await toggleBookmark();
      }
    });
  }, [showUnbookmarkConfirmation, targetId, itemTitle, itemType, toggleBookmark]);

  // Create a new handleBookmarkClick that uses confirmation for unbookmarking
  const handleBookmarkClick = useCallback(() => {
    if (bookmarked) {
      // Show confirmation dialog for unbookmarking
      updatedHandleUnbookmarkConfirmation();
    } else {
      // Use original behavior for bookmarking
      originalHandleBookmarkClick();
    }
  }, [bookmarked, updatedHandleUnbookmarkConfirmation, originalHandleBookmarkClick]);

  return {
    bookmarkCount,
    bookmarked,
    loading,
    error,
    toggleBookmark,
    handleBookmarkClick,
    handleDirectBookmark,
    refreshBookmarkStatus,
    handleUnbookmarkConfirmation: updatedHandleUnbookmarkConfirmation
  };
}

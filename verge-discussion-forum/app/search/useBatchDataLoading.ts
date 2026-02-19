import { useState, useEffect, useCallback, useMemo } from 'react';

interface BatchData {
  bookmarks: { [postId: number]: boolean };
  likes: { [postId: number]: { count: number; liked: boolean } };
  repostLikes: { [repostId: number]: { count: number; liked: boolean } };
}

interface UseBatchDataLoadingProps {
  userId?: string;
  staffPostIds: number[];
  repostIds: number[];
}

export function useBatchDataLoading({ 
  userId, 
  staffPostIds, 
  repostIds 
}: UseBatchDataLoadingProps) {
  const [data, setData] = useState<BatchData>({
    bookmarks: {},
    likes: {},
    repostLikes: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize the IDs to prevent unnecessary API calls
  const staffPostIdsString = useMemo(() => staffPostIds.join(','), [staffPostIds]);
  const repostIdsString = useMemo(() => repostIds.join(','), [repostIds]);

  const loadBatchData = useCallback(async () => {
    if (!userId) {
      return;
    }
    
    // Don't make API calls if we have no IDs to fetch
    if (staffPostIds.length === 0 && repostIds.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const promises = [];

      // Load staff post bookmarks and likes if we have staff posts
      if (staffPostIds.length > 0) {
        promises.push(
          fetch(`/api/bookmarks/batch?userId=${userId}&staffPostIds=${staffPostIdsString}`)
            .then(res => res.json())
            .then(data => ({ type: 'bookmarks', data }))
        );

        promises.push(
          fetch(`/api/staff-posts/likes/batch/mongodb?userId=${userId}&staffPostIds=${staffPostIdsString}`)
            .then(res => res.json())
            .then(data => ({ type: 'likes', data }))
        );
      }

      // Load repost likes if we have reposts
      if (repostIds.length > 0) {
        promises.push(
          fetch(`/api/reposts/likes/batch?userId=${userId}&repostIds=${repostIdsString}`)
            .then(res => res.json())
            .then(data => ({ type: 'repostLikes', data }))
        );
      }

      const results = await Promise.all(promises);

      const newData: BatchData = {
        bookmarks: {},
        likes: {},
        repostLikes: {}
      };

      results.forEach(result => {
        if (result.type === 'bookmarks' && result.data.bookmarks) {
          result.data.bookmarks.forEach((item: any) => {
            newData.bookmarks[item.staffPostId] = item.bookmarked;
          });
        } else if (result.type === 'likes' && result.data.likes) {
          result.data.likes.forEach((item: any) => {
            newData.likes[item.staffPostId] = {
              count: item.likeCount,
              liked: item.liked
            };
          });
        } else if (result.type === 'repostLikes' && result.data.likes) {
          result.data.likes.forEach((item: any) => {
            newData.repostLikes[item.repostId] = {
              count: item.likeCount,
              liked: item.liked
            };
          });
        }
      });

      setData(newData);
    } catch (err: any) {
      setError(err.message || 'Failed to load batch data');
      console.error('Batch data loading error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, staffPostIdsString, repostIdsString]);

  // Load data when dependencies change
  useEffect(() => {
    loadBatchData();
  }, [loadBatchData]);

  // Helper functions to get data for specific posts
  const getBookmarkStatus = useCallback((postId: number) => {
    return data.bookmarks[postId] || false;
  }, [data.bookmarks]);

  const getLikeStatus = useCallback((postId: number) => {
    return data.likes[postId] || { count: 0, liked: false };
  }, [data.likes]);

  const getRepostLikeStatus = useCallback((repostId: number) => {
    return data.repostLikes[repostId] || { count: 0, liked: false };
  }, [data.repostLikes]);

  // Function to refresh data
  const refresh = useCallback(() => {
    loadBatchData();
  }, [loadBatchData]);

  return {
    data,
    loading,
    error,
    getBookmarkStatus,
    getLikeStatus,
    getRepostLikeStatus,
    refresh
  };
} 
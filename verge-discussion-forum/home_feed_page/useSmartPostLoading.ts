import { useState, useEffect, useCallback } from 'react';
import { StaffPost } from '../app/forum_feed_page/staffPostApi';

interface UseSmartPostLoadingProps {
  limit?: number;
  algorithm?: string;
}

interface UseSmartPostLoadingReturn {
  posts: StaffPost[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useSmartPostLoading = ({
  limit = 50,
  algorithm = 'trending',
}: UseSmartPostLoadingProps = {}): UseSmartPostLoadingReturn => {
  const [posts, setPosts] = useState<StaffPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log(`Loading posts with algorithm: ${algorithm}`);
      const res = await fetch(`/api/feed/trending?limit=${limit}&algorithm=${algorithm}&t=${Date.now()}`);
      const data = await res.json();
      console.log(`Loaded ${data.posts?.length || 0} posts for algorithm: ${algorithm}`);
      setPosts(data.posts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load trending posts');
    } finally {
      setLoading(false);
    }
  }, [limit, algorithm]);

  const refresh = useCallback(async () => {
    await loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  return {
    posts,
    loading,
    error,
    refresh,
  };
}; 
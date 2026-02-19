import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface StaffPost {
  id: number;
  userId: string;
  title: string;
  publicationDate: string;
  citedByCount: number;
  abstract: string;
  doi: string;
  linkId: string;
  citation: string;
  relevanceScore?: number;
  createdAt: string;
  subfields: string[];
  authors: string[];
  journal?: string;
  likes: number;
  comments: number;
  bookmarks: number;
  reposts: number;
  score: number;
}

interface UseInterestsFeedReturn {
  posts: StaffPost[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useInterestsFeed(limit = 50, algorithm = "seminal"): UseInterestsFeedReturn {
  const { data: session, status } = useSession();
  const [posts, setPosts] = useState<StaffPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    if (status !== 'authenticated' || !session?.userId) {
      setPosts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/feed/interests?limit=${limit}&algorithm=${algorithm}&t=${Date.now()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch interests feed');
      }

      setPosts(data.posts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch interests feed');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [session?.userId, status, limit, algorithm]);

  const refresh = useCallback(async () => {
    await fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return {
    posts,
    loading,
    error,
    refresh,
  };
} 
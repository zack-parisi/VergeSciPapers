import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface UseLikesProps {
  targetId: string;
  targetType: 'staff_post' | 'mongodb_paper' | 'grant' | 'repost';
  initialLikeCount?: number;
  initialLiked?: boolean;
  skipInitialFetch?: boolean; // New: allow caller to disable the initial fetch
}

interface LikeStatus {
  likeCount: number;
  liked: boolean;
}

export function useLikes({ 
  targetId, 
  targetType, 
  initialLikeCount = 0, 
  initialLiked = false,
  skipInitialFetch = false
}: UseLikesProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [liked, setLiked] = useState(initialLiked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial like status
  useEffect(() => {
    if (!targetId || !targetType) return;
    if (skipInitialFetch) return; // Respect opt-out to reduce network chatter

    const fetchLikeStatus = async () => {
      try {
        const params = new URLSearchParams({
          targetId,
          targetType,
          ...(session?.userId && { userId: session.userId })
        });

        const response = await fetch(`/api/mongodb/likes?${params}`);
        if (response.ok) {
          const data: LikeStatus = await response.json();
          setLikeCount(data.likeCount);
          setLiked(data.liked);
        }
      } catch (err) {
        console.error('Error fetching like status:', err);
      }
    };

    fetchLikeStatus();
  }, [targetId, targetType, session?.userId, skipInitialFetch]);

  // Handle like/unlike with authentication check
  const toggleLike = useCallback(async () => {
    // Check authentication
    if (status === 'loading') return;
    
    if (status !== 'authenticated' || !session?.userId) {
      router.push('/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const method = liked ? 'DELETE' : 'POST';
      const requestBody = { userId: session.userId, targetId, targetType };
      
      console.log(' useLikes sending request:', {
        method,
        targetId,
        targetType,
        userId: session.userId,
        body: requestBody
      });
      
      const body = JSON.stringify(requestBody);

      const response = await fetch('/api/mongodb/likes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body
      });

      if (response.ok) {
        if (liked) {
          // Unlike
          setLiked(false);
          setLikeCount(prev => Math.max(0, prev - 1));
        } else {
          // Like
          setLiked(true);
          setLikeCount(prev => prev + 1);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update like');
        
        // Revert optimistic update
        if (liked) {
          setLiked(false);
          setLikeCount(prev => prev + 1);
        } else {
          setLiked(true);
          setLikeCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      setError('Network error');
      
      // Revert optimistic update
      if (liked) {
        setLiked(false);
        setLikeCount(prev => prev + 1);
      } else {
        setLiked(true);
        setLikeCount(prev => Math.max(0, prev - 1));
      }
    } finally {
      setLoading(false);
    }
  }, [liked, session?.userId, targetId, targetType, status, router]);

  // Handle like click with authentication check
  const handleLikeClick = useCallback(() => {
    if (status === 'loading') return;
    
    if (status !== 'authenticated' || !session?.userId) {
      router.push('/login');
      return;
    }

    toggleLike();
  }, [toggleLike, status, session?.userId, router]);

  return {
    likeCount,
    liked,
    loading,
    error,
    toggleLike,
    handleLikeClick,
    isAuthenticated: status === 'authenticated'
  };
} 
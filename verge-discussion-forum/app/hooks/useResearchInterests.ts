import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Subfield {
  id: string;
  name: string;
}

interface UseResearchInterestsReturn {
  interests: Subfield[];
  loading: boolean;
  error: string | null;
  fetchInterests: () => Promise<void>;
  updateInterests: (subfieldIds: string[]) => Promise<boolean>;
  removeInterest: (subfieldId: string) => Promise<boolean>;
  clearError: () => void;
}

export function useResearchInterests(): UseResearchInterestsReturn {
  const { data: session, status } = useSession();
  const [interests, setInterests] = useState<Subfield[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchInterests = useCallback(async () => {
    if (status !== 'authenticated' || !session?.userId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/interests');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch interests');
      }

      setInterests(data.interests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch interests');
    } finally {
      setLoading(false);
    }
  }, [session?.userId, status]);

  const updateInterests = useCallback(async (subfieldIds: string[]): Promise<boolean> => {
    console.log('updateInterests called - status:', status, 'session:', session);
    console.log('updateInterests called - session?.userId:', session?.userId);
    
    if (status !== 'authenticated' || !session?.userId) {
      console.log('updateInterests - Not authenticated, returning false');
      setError('You must be logged in to update interests');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('updateInterests - Making fetch request to /api/user/interests');
      const response = await fetch('/api/user/interests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subfieldIds }),
      });

      console.log('updateInterests - Response status:', response.status);
      const data = await response.json();
      console.log('updateInterests - Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update interests');
      }

      setInterests(data.interests || []);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update interests');
      return false;
    } finally {
      setLoading(false);
    }
  }, [session?.userId, status]);

  const removeInterest = useCallback(async (subfieldId: string): Promise<boolean> => {
    console.log('removeInterest called - status:', status, 'session:', session);
    console.log('removeInterest called - session?.userId:', session?.userId);
    
    if (status !== 'authenticated' || !session?.userId) {
      console.log('removeInterest - Not authenticated, returning false');
      setError('You must be logged in to remove interests');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('removeInterest - Making fetch request to /api/user/interests');
      const response = await fetch('/api/user/interests', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subfieldId }),
      });

      console.log('removeInterest - Response status:', response.status);
      const data = await response.json();
      console.log('removeInterest - Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove interest');
      }

      setInterests(data.interests || []);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove interest');
      return false;
    } finally {
      setLoading(false);
    }
  }, [session?.userId, status]);

  return {
    interests,
    loading,
    error,
    fetchInterests,
    updateInterests,
    removeInterest,
    clearError,
  };
} 
import { useSession } from 'next-auth/react';
import React from 'react';

export interface ActivityTrackingOptions {
  staffPostId: number;
  trackViews?: boolean;
  trackScroll?: boolean;
  trackTime?: boolean;
  viewThreshold?: number; // milliseconds
  scrollThreshold?: number; // percentage (0-1)
}

export interface ActivityData {
  staffPostId: number | string;
  activityType: 'view' | 'bookmark' | 'comment' | 'share' | 'search_click';
  timeSpentMs?: number;
  scrollPercentage?: number;
  hasInteracted?: boolean;
}

class ActivityTracker {
  private trackingData: Map<number | string, {
    startTime: number;
    hasScrolled: boolean;
    maxScrollPercentage: number;
    hasInteracted: boolean;
    viewTracked: boolean;
    cleanup?: () => void;
  }> = new Map();

  /**
   * Check if an ID is a MongoDB ObjectId
   */
  private isMongoDBId(id: number | string): boolean {
    if (typeof id === 'string') {
      const mongoDBIdPattern = /^[0-9a-fA-F]{24}$/;
      return mongoDBIdPattern.test(id);
    }
    return false;
  }

  /**
   * Track a user activity
   */
  async trackActivity(data: ActivityData): Promise<{ success: boolean; shouldTriggerUpdate?: boolean }> {
    // Skip activity tracking for MongoDB papers
    if (this.isMongoDBId(data.staffPostId)) {
      console.log('Skipping activity tracking for MongoDB paper:', data.staffPostId);
      return { success: true };
    }

    try {
      const response = await fetch('/api/staff-posts/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.warn(`Activity tracking API error: ${response.status} - ${response.statusText}`);
        return { success: false };
      }

      const result = await response.json();
      return {
        success: result.success,
        shouldTriggerUpdate: result.shouldTriggerUpdate
      };

    } catch (error) {
      console.warn('Error tracking activity (non-blocking):', error);
      return { success: false };
    }
  }

  /**
   * Start tracking activity for a staff post
   */
  startTracking(staffPostId: number | string): void {
    // Skip tracking for MongoDB papers
    if (this.isMongoDBId(staffPostId)) {
      console.log('Skipping activity tracking for MongoDB paper:', staffPostId);
      return;
    }
    this.trackingData.set(staffPostId, {
      startTime: Date.now(),
      hasScrolled: false,
      maxScrollPercentage: 0,
      hasInteracted: false,
      viewTracked: false
    });

    // Track scroll events
    const handleScroll = () => {
      const data = this.trackingData.get(staffPostId);
      if (data) {
        const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        data.maxScrollPercentage = Math.max(data.maxScrollPercentage, scrollPercent);
        data.hasScrolled = true;
      }
    };

    // Track user interactions
    const handleInteraction = () => {
      const data = this.trackingData.get(staffPostId);
      if (data) {
        data.hasInteracted = true;
      }
    };

    // Add event listeners
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    // Store cleanup function
    this.trackingData.get(staffPostId)!.cleanup = () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }

  /**
   * Stop tracking and send final activity data
   */
  async stopTracking(staffPostId: number | string): Promise<void> {
    // Skip tracking for MongoDB papers
    if (this.isMongoDBId(staffPostId)) {
      return;
    }
    const data = this.trackingData.get(staffPostId);
    if (!data) return;

    const timeSpentMs = Date.now() - data.startTime;

    // Track view if we haven't already
    if (!data.viewTracked && timeSpentMs > 3000) { // 3 second threshold
      await this.trackActivity({
        staffPostId,
        activityType: 'view',
        timeSpentMs,
        scrollPercentage: data.maxScrollPercentage,
        hasInteracted: data.hasInteracted
      });
      data.viewTracked = true;
    }

    // Cleanup
    if (data.cleanup) {
      data.cleanup();
    }
    this.trackingData.delete(staffPostId);
  }

  /**
   * Track immediate activities (bookmark, comment, share)
   */
  async trackImmediateActivity(staffPostId: number | string, activityType: 'bookmark' | 'comment' | 'share'): Promise<void> {
    await this.trackActivity({
      staffPostId,
      activityType
    });
  }

  /**
   * Track search click activity
   */
  async trackSearchClick(staffPostId: number): Promise<void> {
    await this.trackActivity({
      staffPostId,
      activityType: 'search_click'
    });
  }
}

// Export singleton instance
export const activityTracker = new ActivityTracker();

/**
 * React hook for tracking staff post activity
 */
export function useActivityTracking(options: ActivityTrackingOptions) {
  const { data: session } = useSession();

  const startTracking = () => {
    if (!session?.userId) return;
    activityTracker.startTracking(options.staffPostId);
  };

  const stopTracking = async () => {
    if (!session?.userId) return;
    await activityTracker.stopTracking(options.staffPostId);
  };

  const trackImmediateActivity = async (activityType: 'bookmark' | 'comment' | 'share') => {
    if (!session?.userId) return;
    await activityTracker.trackImmediateActivity(options.staffPostId, activityType);
  };

  const trackSearchClick = async () => {
    if (!session?.userId) return;
    await activityTracker.trackSearchClick(options.staffPostId);
  };

  return {
    startTracking,
    stopTracking,
    trackImmediateActivity,
    trackSearchClick
  };
}

/**
 * Utility function to track activity when component mounts/unmounts
 */
export function useStaffPostActivityTracking(staffPostId: number) {
  const { startTracking, stopTracking, trackImmediateActivity } = useActivityTracking({
    staffPostId,
    trackViews: true,
    trackScroll: true,
    trackTime: true,
    viewThreshold: 3000, // 3 seconds
    scrollThreshold: 0.5 // 50% scroll
  });

  // Start tracking on mount
  React.useEffect(() => {
    startTracking();
    
    // Stop tracking on unmount
    return () => {
      stopTracking();
    };
  }, [staffPostId]);

  return {
    trackImmediateActivity
  };
}

/**
 * Utility function to track activity with custom thresholds
 */
export function useCustomActivityTracking(options: ActivityTrackingOptions) {
  const { startTracking, stopTracking, trackImmediateActivity } = useActivityTracking(options);

  React.useEffect(() => {
    if (options.trackViews) {
      startTracking();
    }
    
    return () => {
      if (options.trackViews) {
        stopTracking();
      }
    };
  }, [options.staffPostId]);

  return {
    trackImmediateActivity
  };
} 
import { PrismaClient } from '@prisma/client';
import { citationUpdateSpider } from './citationUpdateSpider';
import { updatePriorityScore } from './citationPriority';

const prisma = new PrismaClient();

export interface SchedulerStats {
  totalProcessed: number;
  successfulUpdates: number;
  failedUpdates: number;
  averageProcessingTime: number;
  lastRunTime: Date;
  nextScheduledRun: Date;
}

export class CitationScheduler {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private stats: SchedulerStats = {
    totalProcessed: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    averageProcessingTime: 0,
    lastRunTime: new Date(),
    nextScheduledRun: new Date()
  };

  /**
   * Start the citation update scheduler
   */
  async startScheduler(intervalMinutes: number = 60): Promise<void> {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    console.log(`Starting citation update scheduler (interval: ${intervalMinutes} minutes)`);
    this.isRunning = true;

    // Run immediately
    await this.processUpdateQueue();

    // Schedule regular runs
    this.intervalId = setInterval(async () => {
      await this.processUpdateQueue();
    }, intervalMinutes * 60 * 1000);

    // Calculate next run time
    this.stats.nextScheduledRun = new Date(Date.now() + intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the citation update scheduler
   */
  stopScheduler(): void {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    console.log('Stopping citation update scheduler');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Process the citation update queue
   */
  private async processUpdateQueue(): Promise<void> {
    const startTime = Date.now();
    console.log('Processing citation update queue...');

    try {
      // Get papers that need priority score updates
      const papersNeedingPriorityUpdate = await this.getPapersNeedingPriorityUpdate();
      
      if (papersNeedingPriorityUpdate.length > 0) {
        console.log(`Updating priority scores for ${papersNeedingPriorityUpdate.length} papers`);
        
        for (const staffPostId of papersNeedingPriorityUpdate) {
          try {
            await updatePriorityScore(staffPostId);
          } catch (error) {
            console.error(`Failed to update priority score for paper ${staffPostId}:`, error);
          }
        }
      }

      // Process citation updates
      const result = await citationUpdateSpider.processUpdateQueue(20); // Process 20 papers at a time

      // Update stats
      this.stats.totalProcessed += result.processed;
      this.stats.successfulUpdates += result.successful;
      this.stats.failedUpdates += result.failed;
      this.stats.lastRunTime = new Date();
      this.stats.averageProcessingTime = (this.stats.averageProcessingTime + (Date.now() - startTime)) / 2;

      console.log(`Queue processing complete: ${result.processed} processed, ${result.successful} successful, ${result.failed} failed`);

    } catch (error) {
      console.error('Error processing citation update queue:', error);
      this.stats.lastRunTime = new Date();
    }
  }

  /**
   * Get papers that need priority score updates
   */
  private async getPapersNeedingPriorityUpdate(): Promise<number[]> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const papers = await (prisma as any).citationUpdateMetadata.findMany({
      where: {
        updatedAt: {
          lt: oneDayAgo
        }
      },
      select: {
        staffPostId: true
      }
    });

    return papers.map((p: any) => p.staffPostId);
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  /**
   * Manually trigger a citation update for a specific paper
   */
  async triggerManualUpdate(staffPostId: number): Promise<boolean> {
    try {
      console.log(`Manually triggering citation update for paper ${staffPostId}`);
      
      const result = await citationUpdateSpider.updateSingleCitation(staffPostId);
      
      if (result.success) {
        console.log(`Manual update successful: ${result.citationDelta} citation change`);
        return true;
      } else {
        console.error(`Manual update failed: ${result.errorMessage}`);
        return false;
      }
    } catch (error) {
      console.error('Error in manual update:', error);
      return false;
    }
  }

  /**
   * Get papers that need immediate updates (high priority)
   */
  async getHighPriorityPapers(limit: number = 10): Promise<number[]> {
    const papers = await (prisma as any).citationUpdateMetadata.findMany({
      where: {
        updateFrequencyTier: 'high',
        nextScheduledUpdate: {
          lte: new Date()
        }
      },
      orderBy: {
        priorityScore: 'desc'
      },
      select: {
        staffPostId: true
      },
      take: limit
    });

    return papers.map((p: any) => p.staffPostId);
  }

  /**
   * Get papers that need medium priority updates
   */
  async getMediumPriorityPapers(limit: number = 20): Promise<number[]> {
    const papers = await (prisma as any).citationUpdateMetadata.findMany({
      where: {
        updateFrequencyTier: 'medium',
        nextScheduledUpdate: {
          lte: new Date()
        }
      },
      orderBy: {
        priorityScore: 'desc'
      },
      select: {
        staffPostId: true
      },
      take: limit
    });

    return papers.map((p: any) => p.staffPostId);
  }

  /**
   * Get papers that need low priority updates
   */
  async getLowPriorityPapers(limit: number = 30): Promise<number[]> {
    const papers = await (prisma as any).citationUpdateMetadata.findMany({
      where: {
        updateFrequencyTier: 'low',
        nextScheduledUpdate: {
          lte: new Date()
        }
      },
      orderBy: {
        priorityScore: 'desc'
      },
      select: {
        staffPostId: true
      },
      take: limit
    });

    return papers.map((p: any) => p.staffPostId);
  }

  /**
   * Process updates by priority tier
   */
  async processByPriority(): Promise<{
    high: number;
    medium: number;
    low: number;
    total: number;
  }> {
    console.log('Processing updates by priority tier...');

    const highPriority = await this.getHighPriorityPapers();
    const mediumPriority = await this.getMediumPriorityPapers();
    const lowPriority = await this.getLowPriorityPapers();

    let totalProcessed = 0;

    // Process high priority first
    if (highPriority.length > 0) {
      console.log(`Processing ${highPriority.length} high priority papers`);
      const result = await citationUpdateSpider.updateBatchCitations(highPriority);
      totalProcessed += result.length;
    }

    // Process medium priority
    if (mediumPriority.length > 0) {
      console.log(`Processing ${mediumPriority.length} medium priority papers`);
      const result = await citationUpdateSpider.updateBatchCitations(mediumPriority);
      totalProcessed += result.length;
    }

    // Process low priority
    if (lowPriority.length > 0) {
      console.log(`Processing ${lowPriority.length} low priority papers`);
      const result = await citationUpdateSpider.updateBatchCitations(lowPriority);
      totalProcessed += result.length;
    }

    return {
      high: highPriority.length,
      medium: mediumPriority.length,
      low: lowPriority.length,
      total: totalProcessed
    };
  }

  /**
   * Initialize metadata for existing papers
   */
  async initializeExistingPapers(): Promise<void> {
    console.log('Initializing metadata for existing papers...');

    // Get all staff posts
    const staffPosts = await (prisma as any).staffPost.findMany({
      select: {
        id: true,
        citedByCount: true,
        publicationDate: true
      }
    });

    // Get existing metadata to avoid duplicates
    const existingMetadata = await (prisma as any).citationUpdateMetadata.findMany({
      select: {
        staffPostId: true
      }
    });

    const existingIds = new Set(existingMetadata.map((m: any) => m.staffPostId));
    const papersNeedingMetadata = staffPosts.filter((post: any) => !existingIds.has(post.id));

    console.log(`Found ${papersNeedingMetadata.length} papers without metadata`);

    for (const post of papersNeedingMetadata) {
      try {
        await (prisma as any).citationUpdateMetadata.create({
          data: {
            staffPostId: post.id,
            citationCount: post.citedByCount,
            lastCitationCount: post.citedByCount,
            priorityScore: 0.5, // Default score
            updateFrequencyTier: 'low', // Default tier
            nextScheduledUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            citationVelocity: 0,
            lastVelocityCalculation: new Date()
          }
        });
      } catch (error) {
        console.error(`Failed to initialize metadata for paper ${post.id}:`, error);
      }
    }

    console.log('Metadata initialization complete');
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    this.stopScheduler();
    await prisma.$disconnect();
  }
}

// Export singleton instance
export const citationScheduler = new CitationScheduler(); 
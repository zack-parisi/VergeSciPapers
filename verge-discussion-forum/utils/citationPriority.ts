import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PriorityFactors {
  ageFactor: number;
  velocityFactor: number;
  engagementFactor: number;
}

export interface PriorityScore {
  score: number;
  factors: PriorityFactors;
  tier: 'high' | 'medium' | 'low';
  nextUpdateHours: number;
}

/**
 * Calculate age factor based on paper publication date
 * Newer papers get higher priority
 */
export function calculateAgeFactor(publicationDate: Date): number {
  const now = new Date();
  const ageInMonths = (now.getTime() - publicationDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  
  if (ageInMonths < 1) return 1.0;        // < 1 month: 1.0
  if (ageInMonths < 6) return 0.8;        // 1-6 months: 0.8
  if (ageInMonths < 24) return 0.5;       // 6-24 months: 0.5
  return 0.2;                             // > 2 years: 0.2
}

/**
 * Calculate velocity factor based on citation growth rate
 * Papers gaining citations quickly get higher priority
 */
export function calculateVelocityFactor(citationVelocity: number): number {
  if (citationVelocity > 1.0) return 1.0;     // > 1 citation/day: 1.0
  if (citationVelocity > 0.1) return 0.6;     // 0.1-1 citation/day: 0.6
  return 0.2;                                  // < 0.1 citation/day: 0.2
}

/**
 * Calculate engagement factor based on user interactions in last 7 days
 */
export async function calculateEngagementFactor(staffPostId: number): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // Get user activities in last 7 days
  const activities = await (prisma as any).staffPostUserActivity.findMany({
    where: {
      staffPostId,
      activityTimestamp: {
        gte: sevenDaysAgo
      }
    },
    select: {
      activityType: true,
      userId: true
    }
  });
  
  // Count unique users and activity types
  const uniqueUsers = new Set(activities.map((a: any) => a.userId)).size;
  const viewCount = activities.filter((a: any) => a.activityType === 'view').length;
  const bookmarkCount = activities.filter((a: any) => a.activityType === 'bookmark').length;
  const commentCount = activities.filter((a: any) => a.activityType === 'comment').length;
  const shareCount = activities.filter((a: any) => a.activityType === 'share').length;
  
  // Weight different activities
  const totalEngagement = viewCount + (bookmarkCount * 5) + (commentCount * 10) + (shareCount * 3) + (uniqueUsers * 2);
  
  if (totalEngagement > 100) return 1.0;      // High engagement: 1.0
  if (totalEngagement > 50) return 0.8;       // Medium-high: 0.8
  if (totalEngagement > 20) return 0.6;       // Medium: 0.6
  if (totalEngagement > 10) return 0.4;       // Low-medium: 0.4
  return 0.2;                                 // Low: 0.2
}

/**
 * Calculate citation velocity (citations per day)
 */
export function calculateCitationVelocity(
  currentCitationCount: number,
  previousCitationCount: number,
  daysSinceLastUpdate: number
): number {
  if (daysSinceLastUpdate === 0) return 0;
  return (currentCitationCount - previousCitationCount) / daysSinceLastUpdate;
}

/**
 * Calculate comprehensive priority score for a paper
 */
export async function calculatePriorityScore(staffPostId: number): Promise<PriorityScore> {
  // Get paper metadata
  const metadata = await (prisma as any).citationUpdateMetadata.findUnique({
    where: { staffPostId },
    include: {
      staffPost: true
    }
  });
  
  if (!metadata) {
    throw new Error(`No metadata found for staff post ${staffPostId}`);
  }
  
  // Calculate factors
  const ageFactor = calculateAgeFactor(metadata.staffPost.publicationDate);
  const velocityFactor = calculateVelocityFactor(metadata.citationVelocity);
  const engagementFactor = await calculateEngagementFactor(staffPostId);
  
  // Calculate weighted score
  const score = (ageFactor * 0.25) + (velocityFactor * 0.35) + (engagementFactor * 0.40);
  
  // Determine tier and update frequency
  let tier: 'high' | 'medium' | 'low';
  let nextUpdateHours: number;
  
  if (score >= 0.7) {
    tier = 'high';
    nextUpdateHours = 6; // Every 6 hours
  } else if (score >= 0.4) {
    tier = 'medium';
    nextUpdateHours = 24; // Daily
  } else {
    tier = 'low';
    nextUpdateHours = 168; // Weekly
  }
  
  return {
    score,
    factors: { ageFactor, velocityFactor, engagementFactor },
    tier,
    nextUpdateHours
  };
}

/**
 * Update priority score and metadata for a paper
 */
export async function updatePriorityScore(staffPostId: number): Promise<void> {
  const priorityScore = await calculatePriorityScore(staffPostId);
  
  // Calculate next scheduled update
  const nextScheduledUpdate = new Date();
  nextScheduledUpdate.setHours(nextScheduledUpdate.getHours() + priorityScore.nextUpdateHours);
  
  // Update metadata
  await (prisma as any).citationUpdateMetadata.update({
    where: { staffPostId },
    data: {
      priorityScore: priorityScore.score,
      updateFrequencyTier: priorityScore.tier,
      nextScheduledUpdate,
      updatedAt: new Date()
    }
  });
}

/**
 * Get papers that need priority score updates
 */
export async function getPapersNeedingPriorityUpdate(): Promise<number[]> {
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
 * Initialize metadata for a new paper
 */
export async function initializePaperMetadata(staffPostId: number, initialCitationCount: number): Promise<void> {
  const priorityScore = await calculatePriorityScore(staffPostId);
  
  const nextScheduledUpdate = new Date();
  nextScheduledUpdate.setHours(nextScheduledUpdate.getHours() + priorityScore.nextUpdateHours);
  
  await (prisma as any).citationUpdateMetadata.create({
    data: {
      staffPostId,
      citationCount: initialCitationCount,
      lastCitationCount: initialCitationCount,
      priorityScore: priorityScore.score,
      updateFrequencyTier: priorityScore.tier,
      nextScheduledUpdate,
      citationVelocity: 0,
      lastVelocityCalculation: new Date()
    }
  });
} 
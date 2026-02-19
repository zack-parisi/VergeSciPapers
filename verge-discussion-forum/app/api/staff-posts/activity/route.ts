import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/mongodb/[...nextauth]';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { staffPostId, activityType, timeSpentMs, scrollPercentage, hasInteracted } = await request.json();

    if (!staffPostId || !activityType) {
      return NextResponse.json({ error: 'staffPostId and activityType are required' }, { status: 400 });
    }

    // Validate activity type
    const validActivityTypes = ['view', 'bookmark', 'comment', 'share', 'search_click'];
    if (!validActivityTypes.includes(activityType)) {
      return NextResponse.json({ error: 'Invalid activity type' }, { status: 400 });
    }

    // Check if activity already exists for this user today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingActivity = await (prisma as any).staffPostUserActivity.findFirst({
      where: {
        staffPostId: parseInt(staffPostId),
        userId: session.userId,
        activityType,
        activityTimestamp: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    if (existingActivity) {
      // Update existing activity with new data
      await (prisma as any).staffPostUserActivity.update({
        where: { id: existingActivity.id },
        data: {
          timeSpentMs: timeSpentMs || existingActivity.timeSpentMs,
          scrollPercentage: scrollPercentage || existingActivity.scrollPercentage,
          hasInteracted: hasInteracted || existingActivity.hasInteracted,
          activityTimestamp: new Date()
        }
      });
    } else {
      // Create new activity
      await (prisma as any).staffPostUserActivity.create({
        data: {
          staffPostId: parseInt(staffPostId),
          userId: session.userId,
          activityType,
          timeSpentMs,
          scrollPercentage,
          hasInteracted: hasInteracted || false,
          activityTimestamp: new Date()
        }
      });
    }

    // Check if this activity should trigger a citation update
    const shouldTriggerUpdate = await checkIfShouldTriggerUpdate(parseInt(staffPostId), activityType);

    return NextResponse.json({
      success: true,
      shouldTriggerUpdate,
      message: 'Activity tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking activity:', error);
    return NextResponse.json(
      { error: 'Failed to track activity' },
      { status: 500 }
    );
  }
}

/**
 * Check if this activity should trigger a citation update
 */
async function checkIfShouldTriggerUpdate(staffPostId: number, activityType: string): Promise<boolean> {
  try {
    // Get metadata for this paper
    const metadata = await (prisma as any).citationUpdateMetadata.findUnique({
      where: { staffPostId }
    });

    if (!metadata) {
      return false;
    }

    // Immediate triggers
    if (activityType === 'bookmark' || activityType === 'comment' || activityType === 'share') {
      return true;
    }

    // View-based triggers (only if enough time has passed since last update)
    if (activityType === 'view') {
      const lastUpdate = metadata.lastUpdateTimestamp;
      const hoursSinceLastUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

      // Trigger update if more than 24 hours since last update
      return hoursSinceLastUpdate > 24;
    }

    return false;

  } catch (error) {
    console.error('Error checking update trigger:', error);
    return false;
  }
}

/**
 * Get activity statistics for a staff post
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const staffPostId = searchParams.get('staffPostId');
    const days = parseInt(searchParams.get('days') || '7');

    if (!staffPostId) {
      return NextResponse.json({ error: 'staffPostId is required' }, { status: 400 });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const activities = await (prisma as any).staffPostUserActivity.findMany({
      where: {
        staffPostId: parseInt(staffPostId),
        activityTimestamp: {
          gte: cutoffDate
        }
      },
      select: {
        activityType: true,
        userId: true,
        activityTimestamp: true,
        timeSpentMs: true,
        scrollPercentage: true,
        hasInteracted: true
      }
    });

    // Aggregate statistics
    const stats = {
      totalActivities: activities.length,
      uniqueUsers: new Set(activities.map((a: any) => a.userId)).size,
      activityTypes: activities.reduce((acc: any, activity: any) => {
        acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
        return acc;
      }, {}),
      averageTimeSpent: activities
        .filter((a: any) => a.timeSpentMs)
        .reduce((sum: number, a: any) => sum + (a.timeSpentMs || 0), 0) /
        activities.filter((a: any) => a.timeSpentMs).length || 0,
      averageScrollPercentage: activities
        .filter((a: any) => a.scrollPercentage)
        .reduce((sum: number, a: any) => sum + (a.scrollPercentage || 0), 0) /
        activities.filter((a: any) => a.scrollPercentage).length || 0,
      interactionRate: activities.filter((a: any) => a.hasInteracted).length / activities.length || 0
    };

    return NextResponse.json({ success: true, stats });

  } catch (error) {
    console.error('Error getting activity stats:', error);
    return NextResponse.json(
      { error: 'Failed to get activity statistics' },
      { status: 500 }
    );
  }
} 
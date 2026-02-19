import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/mongodb/[...nextauth]';
import { citationScheduler } from '../../../utils/citationScheduler';
import { citationUpdateSpider } from '../../../utils/citationUpdateSpider';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        return await getSystemStats();
      case 'queue':
        return await getQueueStatus();
      case 'priority':
        return await getPriorityPapers();
      default:
        return await getSystemOverview();
    }

  } catch (error) {
    console.error('Error in citation updates API:', error);
    return NextResponse.json(
      { error: 'Failed to get citation update information' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, staffPostId, limit } = await request.json();

    switch (action) {
      case 'update_single':
        if (!staffPostId) {
          return NextResponse.json({ error: 'staffPostId is required' }, { status: 400 });
        }
        return await updateSinglePaper(staffPostId);

      case 'update_batch':
        return await updateBatchPapers(limit || 10);

      case 'process_queue':
        return await processUpdateQueue();

      case 'start_scheduler':
        return await startScheduler();

      case 'stop_scheduler':
        return await stopScheduler();

      case 'update_relevance_scores':
        return await updateRelevanceScores();

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in citation updates API:', error);
    return NextResponse.json(
      { error: 'Failed to perform citation update action' },
      { status: 500 }
    );
  }
}

async function getSystemOverview() {
  const stats = citationScheduler.getStats();
  const staffPostCount = await (prisma as any).staffPost.count();
  const metadataCount = await (prisma as any).citationUpdateMetadata.count();
  const activityCount = await (prisma as any).staffPostUserActivity.count();

  return NextResponse.json({
    success: true,
    overview: {
      totalStaffPosts: staffPostCount,
      papersWithMetadata: metadataCount,
      papersNeedingMetadata: staffPostCount - metadataCount,
      totalActivities: activityCount,
      schedulerStats: stats
    }
  });
}

async function getSystemStats() {
  const stats = citationScheduler.getStats();

  // Get recent activity
  const recentActivities = await (prisma as any).staffPostUserActivity.findMany({
    take: 10,
    orderBy: { activityTimestamp: 'desc' },
    include: {
      staffPost: {
        select: { title: true }
      }
    }
  });

  return NextResponse.json({
    success: true,
    stats,
    recentActivities
  });
}

async function getQueueStatus() {
  const highPriority = await citationScheduler.getHighPriorityPapers(5);
  const mediumPriority = await citationScheduler.getMediumPriorityPapers(5);
  const lowPriority = await citationScheduler.getLowPriorityPapers(5);

  return NextResponse.json({
    success: true,
    queue: {
      highPriority: highPriority.length,
      mediumPriority: mediumPriority.length,
      lowPriority: lowPriority.length,
      total: highPriority.length + mediumPriority.length + lowPriority.length
    }
  });
}

async function getPriorityPapers() {
  const highPriority = await citationScheduler.getHighPriorityPapers(10);
  const mediumPriority = await citationScheduler.getMediumPriorityPapers(10);
  const lowPriority = await citationScheduler.getLowPriorityPapers(10);

  // Get paper details
  const getPaperDetails = async (ids: number[]) => {
    if (ids.length === 0) return [];
    return await (prisma as any).staffPost.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, citedByCount: true }
    });
  };

  const [highPapers, mediumPapers, lowPapers] = await Promise.all([
    getPaperDetails(highPriority),
    getPaperDetails(mediumPriority),
    getPaperDetails(lowPriority)
  ]);

  return NextResponse.json({
    success: true,
    priorityPapers: {
      high: highPapers,
      medium: mediumPapers,
      low: lowPapers
    }
  });
}

async function updateSinglePaper(staffPostId: number) {
  const result = await citationScheduler.triggerManualUpdate(staffPostId);

  return NextResponse.json({
    success: result,
    message: result ? 'Citation update triggered successfully' : 'Failed to trigger citation update'
  });
}

async function updateBatchPapers(limit: number) {
  const result = await citationScheduler.processByPriority();

  return NextResponse.json({
    success: true,
    result,
    message: `Processed ${result.total} papers`
  });
}

async function processUpdateQueue() {
  const result = await citationUpdateSpider.processUpdateQueue(20);

  return NextResponse.json({
    success: true,
    result,
    message: `Queue processing complete: ${result.processed} processed, ${result.successful} successful, ${result.failed} failed`
  });
}

async function startScheduler() {
  await citationScheduler.startScheduler(60);

  return NextResponse.json({
    success: true,
    message: 'Citation update scheduler started'
  });
}

async function stopScheduler() {
  citationScheduler.stopScheduler();

  return NextResponse.json({
    success: true,
    message: 'Citation update scheduler stopped'
  });
}

async function updateRelevanceScores() {
  const result = await citationUpdateSpider.triggerRelevanceScoreUpdate();

  return NextResponse.json({
    success: result.success,
    message: result.message,
    papersUpdated: result.papersUpdated
  });
} 
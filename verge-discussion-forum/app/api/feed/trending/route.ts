import { NextRequest, NextResponse } from 'next/server';
import { getCachedTrendingStaffPosts } from '../trendingUtils';

// Expose cache timestamp for refresh bubble
import { trendingStaffPostsCacheTimestamp } from '../trendingUtils';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('meta') === '1') {
      return NextResponse.json({ cacheTimestamp: trendingStaffPostsCacheTimestamp });
    }
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const algorithm = searchParams.get('algorithm') || 'trending';
    const posts = await getCachedTrendingStaffPosts(limit, algorithm);
    return NextResponse.json({ success: true, posts });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
} 
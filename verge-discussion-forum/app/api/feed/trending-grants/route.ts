import { NextRequest, NextResponse } from 'next/server';
import { getTrendingGrants } from '../trendingUtilsMongo';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const grants = await getTrendingGrants(limit);
    return NextResponse.json({ success: true, grants });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
} 
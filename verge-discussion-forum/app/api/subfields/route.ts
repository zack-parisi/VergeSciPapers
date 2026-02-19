import { NextRequest, NextResponse } from 'next/server';
import { getTopicsV2Collection } from '../../../lib/mongodb-user-interactions.js';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeAll = searchParams.get('includeAll') === 'true';
    
    // Pagination parameters - reduce default limit for better performance
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10); // Reduced from 50 to 20
    const offset = (page - 1) * limit;
    
    // Search parameter
    const searchQuery = searchParams.get('search') || '';
    
    console.log(' Subfields API (topics_v2) called with:', {
      searchQuery,
      page,
      limit,
      offset,
      includeAll
    });
    
    // Get MongoDB topics_v2 collection
    const topicsV2Collection = await getTopicsV2Collection();

    // Read single document containing topic_names
    const doc = await topicsV2Collection.findOne({ _id: 'topics_v2_root' }, { projection: { topic_names: 1 } });
    const allNames: string[] = Array.isArray(doc?.topic_names) ? doc!.topic_names : [];

    // Filter by search query (case-insensitive contains)
    const filtered = searchQuery
      ? allNames.filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
      : allNames;

    // Sort alphabetically to match previous behavior
    const sorted = filtered.slice().sort((a, b) => a.localeCompare(b));

    // Pagination
    const totalCount = sorted.length;
    const paged = sorted.slice(offset, offset + limit);

    // Transform to expected subfields format
    const subfields = paged.map((name) => ({ id: name, name }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return NextResponse.json({
      subfields,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      }
    });
  } catch (error) {
    console.error(' Error fetching subfields (topics_v2):', error);
    return NextResponse.json(
      { error: 'Failed to fetch subfields' },
      { status: 500 }
    );
  }
} 
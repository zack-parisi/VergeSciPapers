import { NextRequest, NextResponse } from 'next/server';
import { getJournalsCollection } from '../../../lib/mongodb-user-interactions.js';

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

    console.log(' Journals API called with:', {
      searchQuery,
      page,
      limit,
      offset,
      includeAll
    });

    // Get MongoDB journals collection
    const journalsCollection = await getJournalsCollection();

    // Read single document containing journal_names
    const doc = await journalsCollection.findOne({ _id: 'journals_root' }, { projection: { journal_names: 1 } });
    const allNames: string[] = Array.isArray(doc?.journal_names) ? doc!.journal_names : [];

    // Filter by search query (case-insensitive contains)
    const filtered = searchQuery
      ? allNames.filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
      : allNames;

    // Sort alphabetically to match previous behavior
    const sorted = filtered.slice().sort((a, b) => a.localeCompare(b));

    // Pagination
    const totalCount = sorted.length;
    const paged = sorted.slice(offset, offset + limit);

    // Transform to expected journals format
    const journals = paged.map((name) => ({ id: name, name }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return NextResponse.json({
      journals,
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
    console.error(' Error fetching journals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journals' },
      { status: 500 }
    );
  }
}

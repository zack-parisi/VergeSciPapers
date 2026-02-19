import { NextRequest, NextResponse } from 'next/server';
import { fetchGrantsFromMongoDB, fetchGrantsByIds } from '../../../lib/mongodb-helpers';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const grantId = searchParams.get('grantId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const agency = searchParams.get('agency');
    const type = searchParams.get('type');
    const searchQuery = searchParams.get('searchQuery');
    const minFunding = searchParams.get('minFunding');
    const deadline = searchParams.get('deadline');
    const statusFilter = searchParams.get('statusFilter');

    if (grantId) {
      // Fetch specific grant by ID
      const grants = await fetchGrantsByIds([grantId]);
      return NextResponse.json({ grants });
    }

    // Fetch grants with pagination and filtering
    const result = await fetchGrantsFromMongoDB({
      page,
      limit,
      agency: agency || undefined,
      type: type || undefined,
      searchQuery: searchQuery || undefined,
      minFunding: minFunding || undefined,
      deadline: deadline || undefined,
      statusFilter: statusFilter || undefined
    });

    return NextResponse.json({ 
      grants: result.grants,
      pagination: result.pagination
    });
  } catch (error) {
    console.error("Error fetching grants:", error);
    return NextResponse.json(
      { error: "Failed to fetch grants" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      title,
      subfield,
      eligibility,
      description,
      deadline,
      fundingAmount,
      grantWebsiteUrl,
    } = await request.json();

    // Validate required fields
    if (!userId || !title || !subfield || !eligibility || !description || !deadline || !fundingAmount || !grantWebsiteUrl) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(grantWebsiteUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid grant website URL" },
        { status: 400 }
      );
    }

    // For now, return an error since we're not creating grants in MongoDB yet
    // This would need to be implemented if you want to allow users to create grants
    return NextResponse.json(
      { error: "Grant creation not yet implemented for MongoDB" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Error creating grant:", error);
    return NextResponse.json(
      { error: "Failed to create grant" },
      { status: 500 }
    );
  }
} 
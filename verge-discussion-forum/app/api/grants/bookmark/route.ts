import { NextRequest, NextResponse } from "next/server";
import { getBookmarksCollection } from "../../../../lib/mongodb-user-interactions";
import { getGrantsCollection } from "../../../../lib/mongodb";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const bookmarksCollection = await getBookmarksCollection();
    const grantsCollection = await getGrantsCollection();

    // Get all grant bookmarks for the user
    const bookmarks = await bookmarksCollection.find({
      userId,
      targetType: 'grant'
    }).toArray();

    // Fetch the actual grant data for each bookmark
    const grantsWithBookmarks = await Promise.all(
      bookmarks.map(async (bookmark: any) => {
        // Handle both string and ObjectId formats
        let grant;
        try {
          // Try to find by ObjectId first
          const { ObjectId } = require('mongodb');
          grant = await grantsCollection.findOne({ _id: new ObjectId(bookmark.targetId) });
        } catch (e) {
          // If ObjectId conversion fails, try as string
          grant = await grantsCollection.findOne({ _id: bookmark.targetId });
        }
        
        if (grant) {
          return {
            ...bookmark,
            grant: {
              id: grant._id.toString(),
              userId: "system",
              title: grant.title || "",
              agency: grant.agency || "",
              type: grant.type || "",
              description: grant.description || "",
              eligibility: grant.eligibility || "",
              amount: grant.amount || "",
              opportunityNumber: grant.opportunityNumber || "",
              dates: grant.dates || "",
              url: grant.url || "",
              createdAt: grant.scraped_at || new Date().toISOString(),
              subfields: [],
              user: {
                id: "system",
                firstName: "System",
                lastName: "User"
              }
            }
          };
        }
        return null;
      })
    );

    const validBookmarks = grantsWithBookmarks.filter(Boolean);

    return NextResponse.json({ bookmarks: validBookmarks });
  } catch (error) {
    console.error("Error fetching grant bookmarks:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookmarks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, grantId } = await request.json();

    if (!userId || !grantId) {
      return NextResponse.json(
        { error: "userId and grantId are required" },
        { status: 400 }
      );
    }

    const bookmarksCollection = await getBookmarksCollection();
    const grantsCollection = await getGrantsCollection();

    // Check if already bookmarked
    const existingBookmark = await bookmarksCollection.findOne({
      userId,
      targetId: grantId,
      targetType: 'grant'
    });

    if (existingBookmark) {
      return NextResponse.json(
        { error: "Grant already bookmarked" },
        { status: 409 }
      );
    }

    // Verify the grant exists
    let grant;
    try {
      // Try to find by ObjectId first
      const { ObjectId } = require('mongodb');
      grant = await grantsCollection.findOne({ _id: new ObjectId(grantId) });
    } catch (e) {
      // If ObjectId conversion fails, try as string
      grant = await grantsCollection.findOne({ _id: grantId });
    }
    
    if (!grant) {
      return NextResponse.json(
        { error: "Grant not found" },
        { status: 404 }
      );
    }

    // Create bookmark
    await bookmarksCollection.insertOne({
      userId,
      targetId: grantId,
      targetType: 'grant',
      createdAt: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error bookmarking grant:", error);
    return NextResponse.json(
      { error: "Failed to bookmark grant" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId, grantId } = await request.json();

    if (!userId || !grantId) {
      return NextResponse.json(
        { error: "userId and grantId are required" },
        { status: 400 }
      );
    }

    const bookmarksCollection = await getBookmarksCollection();

    // Delete bookmark
    const result = await bookmarksCollection.deleteOne({
      userId,
      targetId: grantId,
      targetType: 'grant'
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Grant not bookmarked" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unbookmarking grant:", error);
    return NextResponse.json(
      { error: "Failed to unbookmark grant" },
      { status: 500 }
    );
  }
} 
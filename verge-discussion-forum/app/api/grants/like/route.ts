import { NextRequest, NextResponse } from "next/server";
import { getLikesCollection } from "../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const grantId = searchParams.get("grantId");
    const userId = searchParams.get("userId");

    if (!grantId || !userId) {
      return NextResponse.json(
        { error: "grantId and userId are required" },
        { status: 400 }
      );
    }

    const likesCollection = await getLikesCollection();

    const [likeCount, userLike] = await Promise.all([
      likesCollection.countDocuments({
        targetId: grantId,
        targetType: 'grant'
      }),
      likesCollection.findOne({
        userId,
        targetId: grantId,
        targetType: 'grant'
      })
    ]);

    return NextResponse.json({
      likeCount,
      liked: !!userLike,
    });
  } catch (error) {
    console.error("Error fetching grant like status:", error);
    return NextResponse.json(
      { error: "Failed to fetch like status" },
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

    const likesCollection = await getLikesCollection();

    // Check if already liked
    const existingLike = await likesCollection.findOne({
      userId,
      targetId: grantId,
      targetType: 'grant'
    });

    if (existingLike) {
      return NextResponse.json(
        { error: "Grant already liked" },
        { status: 409 }
      );
    }

    // Create like
    await likesCollection.insertOne({
      userId,
      targetId: grantId,
      targetType: 'grant',
      createdAt: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error liking grant:", error);
    return NextResponse.json(
      { error: "Failed to like grant" },
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

    const likesCollection = await getLikesCollection();

    // Delete like
    const result = await likesCollection.deleteOne({
      userId,
      targetId: grantId,
      targetType: 'grant'
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Grant not liked" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unliking grant:", error);
    return NextResponse.json(
      { error: "Failed to unlike grant" },
      { status: 500 }
    );
  }
} 
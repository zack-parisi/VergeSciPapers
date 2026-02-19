import { NextRequest, NextResponse } from "next/server";
import { getLikesCollection, getUsersCollection } from "../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


// POST: Like an item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log(' Likes API POST request body:', body);
    
    const { userId, targetId, targetType } = body;
    
    console.log(' Extracted values:', { userId, targetId, targetType });
    
    if (!userId || !targetId || !targetType) {
      console.log(' Missing required fields:', { userId: !!userId, targetId: !!targetId, targetType: !!targetType });
      return NextResponse.json({ 
        error: "Missing userId, targetId, or targetType" 
      }, { status: 400 });
    }

    // Validate target type
    const validTargetTypes = ['staff_post', 'mongodb_paper', 'grant', 'repost'];
    if (!validTargetTypes.includes(targetType)) {
      console.log(' Invalid targetType:', targetType, 'Valid types:', validTargetTypes);
      return NextResponse.json({ 
        error: "Invalid targetType. Must be one of: " + validTargetTypes.join(', ') 
      }, { status: 400 });
    }

    console.log(' Validation passed, proceeding with like creation...');

    // Validate user exists
    const usersCollection = await getUsersCollection();
    const user = await usersCollection.findOne({ id: userId });
    if (!user) {
      console.log(' User not found:', userId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const likesCollection = await getLikesCollection();
    
    // Check if already liked
    const existingLike = await likesCollection.findOne({
      userId,
      targetId,
      targetType
    });

    if (existingLike) {
      console.log(' Already liked:', { userId, targetId, targetType });
      return NextResponse.json({ 
        error: "Already liked",
        like: existingLike 
      }, { status: 409 });
    }

    // Create new like
    const newLike = {
      userId,
      targetId,
      targetType,
      createdAt: new Date()
    };

    console.log(' Creating new like:', newLike);

    const result = await likesCollection.insertOne(newLike);
    
    console.log(' Like created successfully:', result.insertedId);
    
    return NextResponse.json({ 
      success: true, 
      like: { ...newLike, _id: result.insertedId }
    });

  } catch (error) {
    console.error(" Error creating like:", error);
    return NextResponse.json({ 
      error: "Failed to create like" 
    }, { status: 500 });
  }
}

// DELETE: Unlike an item
export async function DELETE(req: NextRequest) {
  try {
    const { userId, targetId, targetType } = await req.json();
    
    if (!userId || !targetId || !targetType) {
      return NextResponse.json({ 
        error: "Missing userId, targetId, or targetType" 
      }, { status: 400 });
    }

    const likesCollection = await getLikesCollection();
    
    const result = await likesCollection.deleteOne({
      userId,
      targetId,
      targetType
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        error: "Like not found" 
      }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error deleting like:", error);
    return NextResponse.json({ 
      error: "Failed to delete like" 
    }, { status: 500 });
  }
}

// GET: Get like count and user like status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get("targetId");
    const targetType = searchParams.get("targetType");
    const userId = searchParams.get("userId");

    if (!targetId || !targetType) {
      return NextResponse.json({ 
        error: "Missing targetId or targetType" 
      }, { status: 400 });
    }

    const likesCollection = await getLikesCollection();
    
    // Get total like count
    const likeCount = await likesCollection.countDocuments({
      targetId,
      targetType
    });

    let liked = false;
    
    // Check if user has liked this item
    if (userId) {
      const userLike = await likesCollection.findOne({
        userId,
        targetId,
        targetType
      });
      liked = !!userLike;
    }

    return NextResponse.json({
      likeCount,
      liked
    });

  } catch (error) {
    console.error("Error getting like status:", error);
    return NextResponse.json({ 
      error: "Failed to get like status" 
    }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from "next/server";
import { 
  getRepostsCollection, 
  getUsersCollection, 
  getPostsCollection
} from "../../../../lib/mongodb-user-interactions";

// POST: Create a new Eureka repost
export async function POST(req: NextRequest) {
  try {
    const { userId, content, eurekaData } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    
    if (!eurekaData) {
      return NextResponse.json({ error: "eurekaData is required" }, { status: 400 });
    }

    const usersCollection = await getUsersCollection();
    const repostsCollection = await getRepostsCollection();
    const postsCollection = await getPostsCollection();

    // Check if user can interact (has .edu email)
    const user = await usersCollection.findOne(
      { id: userId },
      { projection: { canInteract: 1, firstName: 1, lastName: 1, email: 1 } }
    );

    if (!user?.canInteract) {
      return NextResponse.json({ 
        error: "Institution email required", 
        message: "You need to be registered with an institution email (.edu) to share Eureka results." 
      }, { status: 403 });
    }

    // Exclude papers from eurekaData when saving repost
    const { papers, ...eurekaDataWithoutPapers } = eurekaData;

    // Generate stable ID for Eureka response
    const eurekaResultId = eurekaData.id || `eureka:${Date.now()}`;

    // 1. Create a new Post record for the Eureka repost
    const post = {
      id: crypto.randomUUID(),
      userId,
      content: content || "",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await postsCollection.insertOne(post);
    
    // 2. Create the Repost record in MongoDB user_data.reposts
    const repost = {
      id: crypto.randomUUID(),
      userId,
      targetId: eurekaResultId,
      targetType: 'eureka_result',
      content: content || null,
      postId: post.id,
      eurekaData: eurekaDataWithoutPapers, // Exclude papers
      createdAt: new Date(),
      updatedAt: new Date(),
      // Embed user data for performance
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    };
    
    const result = await repostsCollection.insertOne(repost);
    
    // Return the created repost with populated data
    const createdRepost = {
      ...repost,
      _id: result.insertedId,
      post
    };

    return NextResponse.json({
      success: true,
      eurekaRepost: createdRepost,
      message: "Eureka result shared successfully"
    });
  } catch (error) {
    console.error("Failed to create Eureka repost:", error);
    return NextResponse.json({ 
      error: "Failed to create Eureka repost",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// GET: Fetch Eureka reposts (for future use if needed)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const repostsCollection = await getRepostsCollection();
    
    let query: any = { targetType: 'eureka_result' };
    if (userId) {
      query.userId = userId;
    }

    const eurekaReposts = await repostsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .toArray();

    return NextResponse.json({
      success: true,
      eurekaReposts,
      count: eurekaReposts.length,
    });
  } catch (error) {
    console.error("Failed to fetch Eureka reposts:", error);
    return NextResponse.json({ 
      error: "Failed to fetch Eureka reposts",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

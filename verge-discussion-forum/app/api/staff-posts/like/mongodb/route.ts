import { NextRequest, NextResponse } from "next/server";
import { getStaffPostsCollection, getUsersCollection, getLikesCollection } from "../../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


// POST: Like a staff post
export async function POST(req: NextRequest) {
  console.log("POST /api/staff-posts/like/mongodb called");
  
  try {
    const body = await req.json();
    console.log("Request body:", body);
    
    const { userId, staffPostId } = body;
    console.log("Extracted data:", { userId, staffPostId });
    
    if (!userId || !staffPostId) {
      console.log("Missing userId or staffPostId");
      return NextResponse.json({ error: "Missing userId or staffPostId" }, { status: 400 });
    }
    
    const usersCollection = await getUsersCollection();
    const staffPostsCollection = await getStaffPostsCollection();
    const likesCollection = await getLikesCollection();
    
    // Validate that the user exists
    const user = await usersCollection.findOne({ id: userId });
    
    if (!user) {
      console.log("User not found:", userId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Validate that the staff post exists - try multiple lookup strategies
    let staffPost = null;
    
    // First, try to find in staff_posts collection (regular staff posts)
    staffPost = await staffPostsCollection.findOne({ _id: staffPostId });
    if (!staffPost) {
      staffPost = await staffPostsCollection.findOne({ id: staffPostId });
    }
    
    // If not found in staff_posts, try to find in papers_clean collection (MongoDB papers)
    if (!staffPost) {
      const { getPapersCleanCollection } = await import("../../../../../lib/mongodb-user-interactions");
      const papersCollection = await getPapersCleanCollection();
      const mongoPaper = await papersCollection.findOne({ _id: staffPostId });
      
      if (mongoPaper) {
        // Transform MongoDB paper to staff post format
        staffPost = {
          _id: mongoPaper._id,
          id: mongoPaper._id.toString(),
          userId: "system",
          title: mongoPaper.title || "",
          abstract: mongoPaper.abstract || "",
          authors: (mongoPaper.authors || []).filter((author: any) => author !== null && author !== undefined),
          subfields: mongoPaper.subfields || [],
          citedByCount: mongoPaper.cited_by_count || 0,
          publicationDate: mongoPaper.publication_date || new Date(),
          doi: mongoPaper.doi || "",
          linkId: mongoPaper._id.toString(),
          citation: `${(mongoPaper.authors || []).filter((author: any) => author !== null && author !== undefined).join(", ") || "Unknown authors"} (${new Date(mongoPaper.publication_date).getFullYear()}). ${mongoPaper.title}. ${mongoPaper.journal || "Unknown journal"}. DOI: ${mongoPaper.doi}`,
          relevanceScore: mongoPaper.relevance_score || 0,
          journal: mongoPaper.journal || "",
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
    }
    
    if (!staffPost) {
      console.log("Staff post not found:", staffPostId);
      return NextResponse.json({ error: "Staff post not found" }, { status: 404 });
    }
    
    console.log("Attempting to upsert like with:", { userId, staffPostId });
    
    // Check if like already exists
    const existingLike = await likesCollection.findOne({ 
      userId, 
      staffPostId: staffPostId.toString() 
    });
    
    let like;
    if (existingLike) {
      // Like already exists, return it
      like = existingLike;
      console.log("Like already exists:", like);
    } else {
      // Create new like
      like = {
        id: require('crypto').randomUUID(),
        userId,
        staffPostId: staffPostId.toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await likesCollection.insertOne(like);
      console.log("Successfully created like:", like);
    }
    
    return NextResponse.json({ success: true, like });
  } catch (e) {
    console.error("Error in POST /api/staff-posts/like/mongodb:", e);
    console.error("Error details:", {
      name: (e as Error).name,
      message: (e as Error).message,
      stack: (e as Error).stack
    });
    
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE: Unlike a staff post
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, staffPostId } = body;
    
    if (!userId || !staffPostId) {
      return NextResponse.json({ error: "Missing userId or staffPostId" }, { status: 400 });
    }
    
    const likesCollection = await getLikesCollection();
    
    const result = await likesCollection.deleteOne({ 
      userId, 
      staffPostId: staffPostId.toString() 
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Not liked yet" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Error in DELETE /api/staff-posts/like/mongodb:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// GET: Get like count and user-like status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const staffPostId = searchParams.get("staffPostId");
    const userId = searchParams.get("userId");
    
    if (!staffPostId) {
      return NextResponse.json({ error: "Missing staffPostId" }, { status: 400 });
    }
    
    const likesCollection = await getLikesCollection();
    
    // Get like count
    const likeCount = await likesCollection.countDocuments({ 
      staffPostId: staffPostId.toString() 
    });
    
    // Check if user has liked this post
    let liked = false;
    if (userId) {
      const existing = await likesCollection.findOne({ 
        userId, 
        staffPostId: staffPostId.toString() 
      });
      liked = !!existing;
    }
    
    return NextResponse.json({ likeCount, liked });
  } catch (e) {
    console.error("Error in GET /api/staff-posts/like/mongodb:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
} 
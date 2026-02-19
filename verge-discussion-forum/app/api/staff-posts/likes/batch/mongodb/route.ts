import { NextRequest, NextResponse } from "next/server";
import { getLikesCollection } from "../../../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const staffPostIds = searchParams.get("staffPostIds");

    if (!staffPostIds) {
      return NextResponse.json({ error: "Missing staffPostIds" }, { status: 400 });
    }

    const staffPostIdsArray = staffPostIds.split(",").filter(id => id.trim());
    
    if (staffPostIdsArray.length === 0) {
      return NextResponse.json({ likes: [] });
    }

    const likesCollection = await getLikesCollection();

    // Get like counts for all staff posts
    const likeCounts = await Promise.all(
      staffPostIdsArray.map(async (staffPostId) => {
        const count = await likesCollection.countDocuments({ 
          staffPostId: staffPostId.trim() 
        });
        return { staffPostId: staffPostId.trim(), likeCount: count };
      })
    );

    // Get user's like status for all staff posts
    let userLikes: any[] = [];
    if (userId) {
      const userLikeDocs = await likesCollection.find({
        userId,
        staffPostId: { $in: staffPostIdsArray.map(id => id.trim()) }
      }).toArray();
      
      userLikes = userLikeDocs.map((doc: any) => ({
        staffPostId: doc.staffPostId,
        liked: true
      }));
    }

    // Combine like counts with user like status
    const likes = likeCounts.map(({ staffPostId, likeCount }) => {
      const userLiked = userLikes.some(ul => ul.staffPostId === staffPostId);
      return {
        staffPostId,
        likeCount,
        liked: userLiked
      };
    });

    return NextResponse.json({ likes });
  } catch (e) {
    console.error("Error in GET /api/staff-posts/likes/batch/mongodb:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
} 
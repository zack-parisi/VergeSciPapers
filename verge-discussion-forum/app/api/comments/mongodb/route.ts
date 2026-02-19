import { NextRequest, NextResponse } from "next/server";
import { getCommentsCollection, getUsersCollection, getBookmarksCollection } from "../../../../lib/mongodb-user-interactions";

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';


export type Comment = {
  id: number;
  userId: string;
  content: string;
  createdAt: string;
  parentId?: number | null;
  userFullName?: string;
  postId?: number;
  staffPostId?: number;
  grantId?: number;
  upvotes?: number;
  userUpvoted?: boolean;
  replies?: Comment[];
};

// GET: Fetch comments for a specific post/staff post/grant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');
    const staffPostId = searchParams.get('staffPostId');
    const grantId = searchParams.get('grantId');
    const targetId = searchParams.get('targetId'); // NEW: Support targetId parameter
    const userId = searchParams.get('userId');

    if (!postId && !staffPostId && !grantId && !targetId) {
      return NextResponse.json({ 
        error: "Missing postId, staffPostId, grantId, or targetId" 
      }, { status: 400 });
    }

    const commentsCollection = await getCommentsCollection();
    const usersCollection = await getUsersCollection();

    // Build query based on provided parameters
    let query: any = { deleted: false };
    let $or: any[] = [];

    // NEW: If targetId is provided, use it as the primary correlation field
    if (targetId) {
      console.log(` Fetching comments for targetId: ${targetId}`);
      query.targetId = targetId;
      console.log(` Final query for targetId:`, JSON.stringify(query, null, 2));
    } else {
      // Legacy approach: use numeric IDs
      const numericPostId = postId ? Number(postId) : undefined;
      const numericStaffPostId = staffPostId ? Number(staffPostId) : undefined;
      const numericGrantId = grantId ? Number(grantId) : undefined;

      // Determine if this is a MongoDB paper based on ID size
      const isMongoDBPaper = (numericPostId && numericPostId > 1000000000) ||
                            (numericStaffPostId && numericStaffPostId > 1000000000);

      if (isMongoDBPaper) {
        // This is a MongoDB paper - look for comments with this postId
        if (numericPostId) $or.push({ postId: numericPostId });
        if (numericStaffPostId) $or.push({ postId: numericStaffPostId });
      } else {
        // This is a staff post - look for comments with this staffPostId
        if (numericPostId) {
          $or.push({ postId: numericPostId });
          $or.push({ staffPostId: numericPostId });
        }
        if (numericStaffPostId) {
          $or.push({ postId: numericStaffPostId });
          $or.push({ staffPostId: numericStaffPostId });
        }
      }

      if (numericGrantId) {
        $or.push({ grantId: numericGrantId });
      }

      if ($or.length > 0) {
        query.$or = $or;
      }
    }

    console.log(" Comment query:", JSON.stringify(query, null, 2));

    // Fetch comments
    const comments = await commentsCollection.find(query).sort({ createdAt: 1 }).toArray();
    console.log(` Found ${comments.length} comments in database`);
    console.log(` Comments found:`, comments.map((c: any) => ({ id: c.id, targetId: c.targetId, content: c.content.substring(0, 30) + "..." })));

    // Fetch user data for all comments
    const userIds = Array.from(new Set(comments.map((comment: any) => comment.userId)));
    const users = await usersCollection.find({ id: { $in: userIds } }).toArray();
    const userMap = new Map(users.map((user: any) => [user.id, user]));

    // Check if current user has upvoted any comments
    let userUpvotes = new Set<number>();
    if (userId) {
      // This would need to be implemented based on your upvote system
      // For now, we'll assume no upvotes
    }

    // Transform comments to include user data and upvote status
    const transformedComments = comments.map((comment: any) => {
      const user = userMap.get(comment.userId) as any;
      return {
        ...comment,
        userFullName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown User',
        userUpvoted: userUpvotes.has(comment.id)
      };
    });

    console.log(` Found ${transformedComments.length} comments`);

    return NextResponse.json(transformedComments);

  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch comments' 
    }, { status: 500 });
  }
}

// POST: Create a new comment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, content, postId, staffPostId, grantId, parentId, targetId } = body;
    
    console.log(" POST /api/comments/mongodb received body:", body);
    console.log(" Extracted parameters:", { userId, content, postId, staffPostId, grantId, parentId, targetId });

    if (!userId || !content) {
      console.log(" Missing userId or content");
      return NextResponse.json({ 
        error: "Missing userId or content" 
      }, { status: 400 });
    }

    if (!postId && !staffPostId && !grantId && !targetId) {
      console.log(" Missing postId, staffPostId, grantId, or targetId");
      return NextResponse.json({ 
        error: "Missing postId, staffPostId, grantId, or targetId" 
      }, { status: 400 });
    }

    const commentsCollection = await getCommentsCollection();
    const usersCollection = await getUsersCollection();
    const bookmarksCollection = await getBookmarksCollection();

    // Check if user can interact (has .edu email)
    const user = await usersCollection.findOne(
      { id: userId },
      { projection: { canInteract: 1 } }
    );

    if (!user?.canInteract) {
      return NextResponse.json({ 
        error: "Institution email required", 
        message: "You need to be registered with an institution email (.edu) to post comments." 
      }, { status: 403 });
    }

    // Generate a unique ID for the comment
    const lastComment = await commentsCollection.findOne({}, { sort: { id: -1 } });
    const newId = lastComment ? lastComment.id + 1 : 1;

    // Determine the correct ID fields to store
    // NEW APPROACH: Create unique comment identifiers for each content type
    let finalPostId = undefined;
    let finalStaffPostId = undefined;
    let finalGrantId = undefined;
    let finalTargetId = undefined;
    
    if (grantId) {
      // This is a grant comment - use grant: prefix
      finalGrantId = Number(grantId);
      finalTargetId = `grant:${grantId}`;
      console.log(` Grant comment - using targetId: ${finalTargetId}`);
    } else if (targetId) {
      // Check if this is a repost (has postId) or a staff post/MongoDB paper
      if (postId && targetId.startsWith('openalex:')) {
        // This is a repost - create unique identifier
        finalTargetId = `repost:${postId}`;
        finalPostId = postId; // Keep as string for repost UUIDs
        console.log(` Repost comment - using targetId: ${finalTargetId}`);
      } else if (staffPostId) {
        // This is a staff post - create unique identifier
        finalTargetId = `staff:${staffPostId}`;
        finalStaffPostId = Number(staffPostId);
        console.log(` Staff post comment - using targetId: ${finalTargetId}`);
      } else if (targetId.startsWith('openalex:')) {
        // This is a MongoDB paper - use the OpenAlex ID directly
        finalTargetId = targetId;
        console.log(` MongoDB paper comment - using targetId: ${finalTargetId}`);
      } else {
        // Fallback - use targetId as provided
        finalTargetId = targetId;
        console.log(` Using targetId as provided: ${targetId}`);
      }
    } else if (postId || staffPostId) {
      // Legacy approach: determine if this is a MongoDB paper or staff post
      const numericPostId = postId ? Number(postId) : undefined;
      const numericStaffPostId = staffPostId ? Number(staffPostId) : undefined;
      
      // Determine if this is a MongoDB paper based on ID size
      const isMongoDBPaper = (numericPostId && numericPostId > 1000000000) || 
                            (numericStaffPostId && numericStaffPostId > 1000000000);
      
      if (isMongoDBPaper) {
        // This is a MongoDB paper - store as postId and create targetId
        finalPostId = numericPostId || numericStaffPostId;
        finalTargetId = `openalex:https://openalex.org/W${finalPostId}`;
        console.log(` MongoDB paper comment (legacy) - using targetId: ${finalTargetId}`);
      } else {
        // This is a staff post - store as staffPostId and create targetId
        finalStaffPostId = numericStaffPostId || numericPostId;
        finalTargetId = `staff:${finalStaffPostId}`;
        console.log(` Staff post comment (legacy) - using targetId: ${finalTargetId}`);
      }
    }

    const newComment = {
      id: newId,
      userId,
      content,
      createdAt: new Date().toISOString(),
      parentId: parentId ? Number(parentId) : null,
      deleted: false,
      postId: finalPostId,
      staffPostId: finalStaffPostId,
      grantId: finalGrantId,
      targetId: finalTargetId, // NEW: Store targetId for correlation
      upvotes: 0
    };

    console.log(" Creating new comment:", newComment);
    console.log(" Input parameters:", { userId, content: content.substring(0, 50) + "...", postId, staffPostId, grantId, targetId, parentId });
    console.log(" Final IDs:", { finalPostId, finalStaffPostId, finalGrantId, finalTargetId });

    const result = await commentsCollection.insertOne(newComment);

    if (result.acknowledged) {
      // Fetch user data for the new comment
      const userData = await usersCollection.findOne({ id: userId });
      
      const commentWithUser = {
        ...newComment,
        userFullName: userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'Unknown User',
        userUpvoted: false
      };

      return NextResponse.json(commentWithUser, { status: 201 });
    } else {
      throw new Error("Failed to insert comment");
    }

  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json({ 
      error: "Failed to create comment" 
    }, { status: 500 });
  }
}

// DELETE: Delete a comment (hard delete - completely remove from MongoDB)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("id");
    const userId = searchParams.get("userId"); // Get the user ID from query params

    console.log(" Deleting comment with ID:", commentId, "by user:", userId);

    if (!commentId) {
      return NextResponse.json({ 
        error: "Missing comment ID" 
      }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ 
        error: "Missing user ID" 
      }, { status: 400 });
    }

    const commentsCollection = await getCommentsCollection();

    // First, check if the comment exists and get its details
    const existingComment = await commentsCollection.findOne({ id: Number(commentId) });
    console.log(" Existing comment found:", existingComment ? "Yes" : "No");

    if (!existingComment) {
      return NextResponse.json({ 
        error: "Comment not found" 
      }, { status: 404 });
    }

    // Check if the user is authorized to delete this comment
    if (existingComment.userId !== userId) {
      console.log(" Unauthorized deletion attempt:", {
        commentUserId: existingComment.userId,
        requestingUserId: userId
      });
      return NextResponse.json({ 
        error: "Unauthorized: You can only delete your own comments" 
      }, { status: 403 });
    }

    // Perform hard delete - completely remove from MongoDB
    console.log(" Performing hard delete for comment:", commentId);
    const result = await commentsCollection.deleteOne({ id: Number(commentId) });

    console.log(" Delete result:", {
      deletedCount: result.deletedCount,
      acknowledged: result.acknowledged
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        error: "Comment not found or already deleted" 
      }, { status: 404 });
    }

    console.log(" Comment deleted successfully from MongoDB");
    return NextResponse.json({ 
      success: true,
      message: "Comment permanently deleted"
    });

  } catch (error) {
    console.error(" Error deleting comment:", error);
    return NextResponse.json({ 
      error: "Failed to delete comment" 
    }, { status: 500 });
  }
}

// PATCH: Handle upvotes and other comment actions
export async function PATCH(req: NextRequest) {
  try {
    const { id, action, userId } = await req.json();

    if (!id || !action || !userId) {
      return NextResponse.json({ 
        error: "Missing id, action, or userId" 
      }, { status: 400 });
    }

    const commentsCollection = await getCommentsCollection();

    if (action === "upvote") {
      // Check if user has already upvoted
      const comment = await commentsCollection.findOne({ id: Number(id) });
      
      if (!comment) {
        return NextResponse.json({ 
          error: "Comment not found" 
        }, { status: 404 });
      }

      // For now, just increment upvotes (TODO: Implement proper upvote tracking)
      const result = await commentsCollection.updateOne(
        { id: Number(id) },
        { $inc: { upvotes: 1 } }
      );

      if (result.matchedCount === 0) {
        return NextResponse.json({ 
          error: "Comment not found" 
        }, { status: 404 });
      }

      // Get updated comment
      const updatedComment = await commentsCollection.findOne({ id: Number(id) });

      return NextResponse.json({
        upvotes: updatedComment.upvotes || 0,
        userUpvoted: true // TODO: Implement proper user upvote tracking
      });
    } else if (action === "cleanup") {
      // Cleanup old deleted comments (older than 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const result = await commentsCollection.deleteMany({
        deleted: true,
        deletedAt: { $lt: thirtyDaysAgo.toISOString() }
      });
      
      console.log(` Cleaned up ${result.deletedCount} old deleted comments`);
      
      return NextResponse.json({
        success: true,
        deletedCount: result.deletedCount
      });
    }

    return NextResponse.json({ 
      error: "Invalid action" 
    }, { status: 400 });

  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json({ 
      error: "Failed to update comment" 
    }, { status: 500 });
  }
} 
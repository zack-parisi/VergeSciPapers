import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// POST /api/bookmarks { userId, postId, staffPostId }
export async function POST(req: NextRequest) {
  const { userId, postId, staffPostId } = await req.json();
  
  if (!userId || (!postId && !staffPostId)) {
    return NextResponse.json({ error: "Missing userId and postId or staffPostId" }, { status: 400 });
  }
  try {
    let bookmark;
    if (postId) {
      const numericPostId = Number(postId);
      bookmark = await prisma.bookmark.upsert({
        where: { userId_postId: { userId, postId: numericPostId } },
        update: {},
        create: { userId, postId: numericPostId },
      });
      await prisma.post.update({
        where: { id: numericPostId },
        data: { saveCount: { increment: 1 } },
      });
    } else if (staffPostId) {
      const numericStaffPostId = Number(staffPostId);
      bookmark = await prisma.bookmark.upsert({
        where: { userId_staffPostId: { userId, staffPostId: numericStaffPostId } },
        update: {},
        create: { userId, staffPostId: numericStaffPostId },
      });
    }
    return NextResponse.json({ success: true, bookmark });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE /api/bookmarks { userId, postId, staffPostId }
export async function DELETE(req: NextRequest) {
  const { userId, postId, staffPostId } = await req.json();
  if (!userId || (!postId && !staffPostId)) {
    return NextResponse.json({ error: "Missing userId and postId or staffPostId" }, { status: 400 });
  }
  try {
    if (postId) {
      await prisma.bookmark.delete({
        where: { userId_postId: { userId, postId } },
      });
      await prisma.post.update({
        where: { id: postId },
        data: { saveCount: { decrement: 1 } },
      });
    } else if (staffPostId) {
      try {
        const deletedCount = await prisma.bookmark.deleteMany({
          where: { 
            userId, 
            staffPostId,
            postId: null // Ensure we're only deleting staff post bookmarks
          },
        });
        console.log(`Deleted ${deletedCount.count} bookmarks for user ${userId} and staffPost ${staffPostId}`);
      } catch (error) {
        console.error("Error deleting staff post bookmark:", error);
        // Don't throw error if bookmark doesn't exist - that's okay
      }
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// GET /api/bookmarks?userId=... or /api/bookmarks?postId=... or /api/bookmarks?staffPostId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const postId = searchParams.get("postId");
  const staffPostId = searchParams.get("staffPostId");
  try {
    if (userId) {
      // Get all bookmarks for a user
      const bookmarks = await prisma.bookmark.findMany({
        where: { userId },
        include: {
          post: {
            include: {
              repost: {
                include: { 
                  staffPost: {
                    include: {
                      subfields: true,
                      authors: true,
                    },
                  },
                  user: true
                }
              }
            }
          },
          staffPost: {
            include: {
              subfields: true,
              authors: true,
            },
          },
        },
      });
      // Get all grant bookmarks for a user
      const grantBookmarks = await prisma.grantBookmark.findMany({
        where: { userId },
        include: {
          grant: {
            include: { user: true },
          },
        },
      });
      // Transform bookmarks to flatten reposts for frontend and add userFullName
      const transformedBookmarks = bookmarks.map((b: any) => {
        if (b.post && b.post.repost) {
          const repostUser = b.post.repost.user;
          const userFullName = repostUser?.firstName && repostUser?.lastName
            ? `${repostUser.firstName} ${repostUser.lastName}`
            : repostUser?.firstName || repostUser?.lastName || repostUser?.id || "User";
          
          return {
            ...b,
            post: {
              ...b.post,
              ...b.post.repost,
              type: "repost",
              staffPost: b.post.repost.staffPost ? {
                ...b.post.repost.staffPost,
                authors: b.post.repost.staffPost.authors?.map((a: any) => a.name) || [],
                subfields: b.post.repost.staffPost.subfields?.map((s: any) => s.name) || [],
                citation: b.post.repost.staffPost.citation || "",
              } : b.post.repost.staffPost,
              userFullName,
            }
          };
        }
        
        // Transform direct staff post bookmarks
        if (b.staffPost) {
          return {
            ...b,
            staffPost: {
              ...b.staffPost,
              authors: b.staffPost.authors?.map((a: any) => a.name) || [],
              subfields: b.staffPost.subfields?.map((s: any) => s.name) || [],
              citation: b.staffPost.citation || "",
            }
          };
        }
        
        return b;
      });
      return NextResponse.json({ bookmarks: transformedBookmarks, grantBookmarks });
    } else if (postId) {
      // Get all users who bookmarked a post
      const bookmarks = await prisma.bookmark.findMany({
        where: { postId: Number(postId) },
        include: { user: true },
      });
      return NextResponse.json({ bookmarks });
    } else if (staffPostId) {
      // Get all users who bookmarked a staff post
      const bookmarks = await prisma.bookmark.findMany({
        where: { staffPostId: Number(staffPostId) },
        include: { user: true },
      });
      return NextResponse.json({ bookmarks });
    } else {
      return NextResponse.json({ error: "Missing userId, postId, or staffPostId param" }, { status: 400 });
    }
  } catch (e) {
    console.error("Bookmarks API error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
} 
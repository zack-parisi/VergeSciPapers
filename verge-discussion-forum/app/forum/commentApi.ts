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

export async function fetchComments(
  postId?: number,
  staffPostId?: number,
  grantId?: number,
  parentId?: number,
  targetId?: string // NEW: Add targetId parameter
): Promise<Comment[]> {
  const params = new URLSearchParams();
  
  // NEW: If targetId is provided, use it as the primary correlation field
  console.log(" fetchComments received parameters:", { postId, staffPostId, grantId, targetId });
  
  if (targetId) {
    params.append("targetId", targetId);
    console.log(` Fetching comments for targetId: ${targetId}`);
  } else {
    console.log(" No targetId provided, using legacy approach");
    // Legacy approach: use numeric IDs
    if (postId !== undefined) params.append("postId", postId.toString());
    if (staffPostId !== undefined) params.append("staffPostId", staffPostId.toString());
    if (grantId !== undefined) params.append("grantId", grantId.toString());
  }
  
  if (parentId !== undefined) params.append("parentId", parentId.toString());

  console.log(" fetchComments API call:", {
    postId,
    staffPostId,
    grantId,
    targetId,
    parentId,
    url: `/api/comments/mongodb?${params.toString()}`
  });
  
  const res = await fetch(`/api/comments/mongodb?${params.toString()}`);
  console.log(" fetchComments response status:", res.status, res.statusText);
  if (!res.ok) {
    const errorText = await res.text();
    console.error(" fetchComments failed:", errorText);
    throw new Error("Failed to fetch comments");
  }
  const data = await res.json();
  console.log(" fetchComments response:", data);
  return data;
}

export async function postComment(
  userId: string,
  content: string,
  postId?: number,
  parentId?: number,
  staffPostId?: number,
  grantId?: number | string,
  targetId?: string // NEW: Add targetId parameter
): Promise<Comment> {
  const body: any = { userId, content };
  
  // NEW: If targetId is provided, use it as the primary correlation field
  if (targetId) {
    body.targetId = targetId;
    console.log(` Using targetId for comment: ${targetId}`);
  } else {
    // Legacy approach: determine if this is a MongoDB paper or staff post based on ID format
    const isMongoDBPaper = (postId && postId > 1000000000) || (staffPostId && staffPostId > 1000000000);
    
    if (isMongoDBPaper) {
      // This is a MongoDB paper - pass both IDs if available
      if (postId !== undefined) body.postId = postId;
      if (staffPostId !== undefined) body.postId = staffPostId; // Use staffPostId as postId for MongoDB papers
    } else {
      // This is a staff post - pass staffPostId
      if (staffPostId !== undefined) body.staffPostId = staffPostId;
      if (postId !== undefined) body.staffPostId = postId; // Use postId as staffPostId for staff posts
    }
    
    if (grantId !== undefined) body.grantId = grantId;
  }
  
  if (parentId !== undefined) body.parentId = parentId;

  console.log(" postComment request body:", body);
  console.log(" postComment request body JSON:", JSON.stringify(body));

  const res = await fetch("/api/comments/mongodb", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || errorData.error || "Failed to post comment");
  }
  const data = await res.json();
  console.log(" postComment response:", data);
  return data;
}

export async function deleteComment(id: number, userId: string): Promise<void> {
  console.log(" Frontend: Attempting to delete comment with ID:", id, "by user:", userId);
  
  const res = await fetch(`/api/comments/mongodb?id=${id}&userId=${userId}`, {
    method: "DELETE",
  });
  
  console.log(" Frontend: Delete response status:", res.status);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(" Frontend: Delete failed with error:", errorText);
    throw new Error("Failed to delete comment");
  }
  
  console.log(" Frontend: Comment deleted successfully");
}

export async function upvoteComment(commentId: number, userId: string): Promise<{ upvotes: number; userUpvoted: boolean }> {
  const res = await fetch("/api/comments/mongodb", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: commentId, action: "upvote", userId }),
  });
  if (!res.ok) throw new Error("Failed to upvote comment");
  return res.json();
}

export async function bookmarkStaffPost(userId: string, staffPostId: number) {
  const res = await fetch("/api/mongodb/bookmarks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, targetId: staffPostId.toString(), targetType: "staff_post" }),
  });
  if (!res.ok) throw new Error("Failed to bookmark staff post");
  return res.json();
}

export async function unbookmarkStaffPost(userId: string, staffPostId: number) {
  const res = await fetch("/api/mongodb/bookmarks", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, targetId: staffPostId.toString(), targetType: "staff_post" }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error("Unbookmark error:", errorData);
    throw new Error(`Failed to unbookmark staff post: ${errorData.error || res.statusText}`);
  }
  return res.json();
}

// Optionally, implement fetchUserUpvotedComments if you want to optimize upvoted state fetching 
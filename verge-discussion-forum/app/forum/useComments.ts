import { useEffect, useState } from "react";
import { fetchComments, postComment, Comment, deleteComment } from "./commentApi";

export function useComments(
  postId?: number, 
  staffPostId?: number, 
  grantId?: number,
  targetId?: string // NEW: Add targetId parameter
) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadComments = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log(" Loading comments for:", { postId, staffPostId, grantId, targetId });
      
      // Don't make API call if no parameters are provided
      if (!postId && !staffPostId && !grantId && !targetId) {
        console.log(" No parameters provided, skipping API call");
        setComments([]);
        return;
      }
      
      const data = await fetchComments(postId, staffPostId, grantId, undefined, targetId);
      console.log(" Loaded comments:", data.length, "comments");
      console.log(" Comments data:", data);
      setComments(data);
    } catch (err) {
      console.error(" Error loading comments:", err);
      setError("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log(" useComments useEffect triggered with:", { postId, staffPostId, grantId, targetId });
    console.log(" useComments useEffect dependencies changed, calling loadComments");
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, staffPostId, grantId, targetId]);

  return { comments, loading, error, refresh: loadComments, setComments };
}

export function usePostComment(
  postId: number | undefined, 
  userId: string, 
  onSuccess?: () => void, 
  staffPostId?: number, 
  grantId?: number | string,
  targetId?: string // NEW: Add targetId parameter
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [institutionEmailError, setInstitutionEmailError] = useState<boolean>(false);

  const submit = async (content: string, parentId?: number) => {
    setLoading(true);
    setError(null);
    setInstitutionEmailError(false);
    try {
      await postComment(userId, content, postId, parentId, staffPostId, grantId, targetId);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      if (err.message?.includes("Institution email required") || err.message?.includes("institution email")) {
        setInstitutionEmailError(true);
      } else {
        setError("Failed to post comment");
      }
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading, error, institutionEmailError };
}

export function useDeleteComment(forceRefresh?: () => void, userId?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: number) => {
    console.log(" useDeleteComment: Starting deletion for comment ID:", id, "by user:", userId);
    setLoading(true);
    setError(null);
    try {
      if (!userId) {
        throw new Error("User ID required for comment deletion");
      }
      await deleteComment(id, userId);
      console.log(" useDeleteComment: Comment deleted, calling forceRefresh");
      if (forceRefresh) {
        forceRefresh();
      }
    } catch (err) {
      console.error(" useDeleteComment: Error during deletion:", err);
      setError("Failed to delete comment");
    } finally {
      setLoading(false);
    }
  };

  return { remove, loading, error };
}

export function useReplies(parentId: number, postId?: number, staffPostId?: number, grantId?: number) {
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Since replies are already included in the main comments data,
  // we don't need to make a separate API call
  const loadReplies = async () => {
    // This function is kept for compatibility but doesn't make API calls
    // Replies are handled by the parent component
  };

  return { replies, loading, error, refresh: loadReplies };
} 
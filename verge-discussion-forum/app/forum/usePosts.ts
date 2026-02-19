import { useState, useEffect, useCallback } from "react";

export interface Post {
  id: number;
  userId: string;
  content: string;
  createdAt: string;
  type: "post";
}

export interface Repost {
  id: number;
  userId: string;
  content: string | null;
  createdAt: string;
  staffPost: any;
  postId: number;
  type: "repost";
}

type FeedItem = Post | Repost;

export function usePosts() {
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [postsRes, repostsRes] = await Promise.all([
        fetch("/api/posts"),
        fetch("/api/reposts/mongodb"),
      ]);
      if (!postsRes.ok) throw new Error("Failed to fetch posts");
      if (!repostsRes.ok) throw new Error("Failed to fetch reposts");
      const postsDataRaw = await postsRes.json();
      
      // Handle new paginated reposts response structure
      const repostsResponse = await repostsRes.json();
      const repostsData = (repostsResponse.reposts || repostsResponse).map((r: any) => ({ ...r, type: "repost" }));
      
      // Exclude posts that are referenced by a repost
      const repostedPostIds = new Set(repostsData.map((r: any) => r.postId));
      const postsData = postsDataRaw
        .filter((p: any) => !repostedPostIds.has(p.id))
        .map((p: any) => ({ ...p, type: "post" }));
      const merged = [...postsData, ...repostsData].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setPosts(merged);
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // createPost, deletePost, editPost remain unchanged and only affect regular posts
  const createPost = async (userId: string, content: string) => {
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, content }),
      });
      if (!res.ok) throw new Error("Failed to create post");
      const newPost = await res.json();
      setPosts((prev) => [{ ...newPost, type: "post" }, ...prev]);
      return newPost;
    } catch (e: any) {
      setError(e.message || "Unknown error");
      throw e;
    }
  };

  const deletePost = async (id: number, type?: string) => {
    setError(null);
    try {
      let res;
      if (type === "repost") {
        res = await fetch(`/api/reposts/mongodb?postId=${id}`, { method: "DELETE" });
      } else {
        res = await fetch(`/api/posts?id=${id}`, { method: "DELETE" });
      }
      if (!res.ok) throw new Error("Failed to delete post");
      setPosts((prev) => prev.filter((p) => {
        // For reposts, check postId; for regular posts, check id
        if (type === "repost") {
          return (p as any).postId !== id;
        }
        return p.id !== id;
      }));
    } catch (e: any) {
      setError(e.message || "Unknown error");
      throw e;
    }
  };

  const editPost = async (id: number, content: string, type?: string) => {
    setError(null);
    try {
      let res;
      if (type === "repost") {
        res = await fetch(`/api/reposts/mongodb`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: id, content }),
        });
      } else {
        res = await fetch(`/api/posts`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, content }),
        });
      }
      if (!res.ok) throw new Error("Failed to update post");
      const updated = await res.json();
      setPosts((prev) => prev.map((p) => {
        // For reposts, check postId; for regular posts, check id
        if (type === "repost") {
          return (p as any).postId === id ? { ...p, content: updated.content } : p;
        }
        return p.id === id ? { ...p, content: updated.content } : p;
      }));
      return updated;
    } catch (e: any) {
      setError(e.message || "Unknown error");
      throw e;
    }
  };

  return { posts, loading, error, refresh: fetchPosts, createPost, deletePost, editPost };
} 
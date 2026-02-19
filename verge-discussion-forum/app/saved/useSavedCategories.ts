import { useState, useCallback } from "react";

export function useSavedCategories(userId: string | undefined) {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all categories for a user
  const fetchCategories = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      console.log(" Fetching categories from API for userId:", userId);
      const res = await fetch(`/api/saved-categories/mongodb?userId=${userId}`);
      const data = await res.json();
      // DEBUG: Log API response
      console.log("[DEBUG] /api/saved-categories/mongodb response:", data);
      if (data.categories) {
        setCategories(data.categories);
      } else {
        setCategories([]);
      }
      // DEBUG: Log categories state after set
      console.log("[DEBUG] categories state after set:", categories);
    } catch (e: any) {
      setError(e.message || "Failed to fetch categories");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Create a new category
  const createCategory = useCallback(async (name: string) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-categories/mongodb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name }),
      });
      const data = await res.json();
      if (data.category) setCategories((prev) => [data.category, ...prev]);
      return data.category;
    } catch (e: any) {
      setError(e.message || "Failed to create category");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Add a post, staff post, repost, or eureka response to a category
  const addPostToCategory = useCallback(
    async (categoryId: number | string, id: number | string, type: 'post' | 'staffPost' | 'repost' | 'eureka_result' = 'post', completeData?: any) => {
      setLoading(true);
      setError(null);
      try {
        const targetType = type === 'post' ? 'post' : type === 'staffPost' ? 'staff_post' : type === 'repost' ? 'repost' : 'eureka_result';
        
        // First, create a bookmark if it doesn't exist
        // This ensures the post has the proper targetId structure
        try {
          const bookmarkBody = {
            userId,
            targetId: completeData?.targetId || id.toString(),
            targetType,
            completeData
          };
          
          console.log(" Creating bookmark for project addition:", bookmarkBody);
          
          await fetch("/api/mongodb/bookmarks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bookmarkBody),
          });
          
          console.log(" Bookmark created successfully");
        } catch (bookmarkError: any) {
          // If bookmark already exists, that's fine - continue
          if (bookmarkError.message?.includes("already exists") || bookmarkError.message?.includes("duplicate")) {
            console.log(" Bookmark already exists, continuing...");
          } else {
            console.warn(" Failed to create bookmark:", bookmarkError);
            // Continue anyway - the category addition should still work
          }
        }
        
        // Then add to category
        const body = {
          categoryId,
          targetId: completeData?.targetId || id.toString(),
          targetType,
          completeData,
          postId: type === 'repost' ? id.toString() : undefined // For reposts, pass the postId
        };
        
        console.log(" Adding to category:", body);
        
        const res = await fetch("/api/saved-categories/mongodb", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        await fetchCategories();
        return data.saved;
      } catch (e: any) {
        setError(e.message || "Failed to add post");
      } finally {
        setLoading(false);
      }
    },
    [fetchCategories, userId]
  );

  // Remove a post from a category
  const removePostFromCategory = useCallback(async (categoryId: number | string, postId: number | string, targetType: string = 'post') => {
    setLoading(true);
    setError(null);
    try {
      console.log(" removePostFromCategory called:", {
        categoryId,
        postId,
        targetType
      });
      
      const res = await fetch("/api/saved-categories/mongodb", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          categoryId, 
          targetId: postId.toString(),
          targetType 
        }),
      });
      const data = await res.json();
      console.log(" removePostFromCategory API response:", data);
      await fetchCategories();
      return data.success;
    } catch (e: any) {
      setError(e.message || "Failed to remove post");
    } finally {
      setLoading(false);
    }
  }, [fetchCategories]);

  // Delete a category
  const deleteCategory = useCallback(async (categoryId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/saved-categories/mongodb?id=${categoryId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      setCategories((prev) => prev.filter((cat) => cat.id !== categoryId));
      return data.success;
    } catch (e: any) {
      setError(e.message || "Failed to delete category");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    addPostToCategory,
    removePostFromCategory,
    deleteCategory,
    setCategories, // for manual updates if needed
  };
}

/**
 * Example usage:
 *
 * const { categories, fetchCategories, createCategory, addPostToCategory, removePostFromCategory, deleteCategory, loading, error } = useSavedCategories(userId);
 *
 * useEffect(() => { fetchCategories(); }, [fetchCategories]);
 *
 * // To create: await createCategory("Sleep Cycles");
 * // To add: await addPostToCategory(categoryId, postId);
 * // To remove: await removePostFromCategory(categoryId, postId);
 * // To delete: await deleteCategory(categoryId);
 */ 
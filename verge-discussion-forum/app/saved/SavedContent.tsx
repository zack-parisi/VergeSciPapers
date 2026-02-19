"use client";
import Box from "@mui/material/Box";
import { useSession } from "next-auth/react";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ForumPage from "../forum/page";
import CommentPopup from "../forum/CommentPopup";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import NoteIcon from "@mui/icons-material/Note";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import Typography from "@mui/material/Typography";
import { useSavedCategories } from "./useSavedCategories";
import SavedPostCard from "./SavedPostCard";
import ForumFeedStaffPostCard from "./ForumFeedStaffPostCard";
import SavedRepostCard from "./SavedRepostCard";
import SavedEurekaResponseCard from "./SavedEurekaResponseCard";
import CategoryModal from "./CategoryModal";
import DeleteCategoryDialog from "./DeleteCategoryDialog";
import ForumPreviewModal from "./ForumPreviewModal";
import StaffPostPreviewModal from "./StaffPostPreviewModal";
import BookmarkedGrantsSection from "./BookmarkedGrantsSection";
import BookmarkedPostsSection from "./BookmarkedPostsSection";
import BookmarkedForumsSection from "./BookmarkedForumsSection";
import GrantCard from "../grants/GrantCard";
import StaffPostCard from "../../home_feed_page/StaffPostCard";
import FeedCard from "../forum/FeedCard";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import ProjectNoteButton from "./ProjectNoteButton";
import IndividualPostNoteButton from "./IndividualPostNoteButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

interface SavedContentProps {
  onOpenCategoryModal?: () => void;
}

const SavedContent: React.FC<SavedContentProps> = ({ onOpenCategoryModal }) => {
  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [previewPostId, setPreviewPostId] = useState<number | string | null>(
    null
  );
  const [previewStaffPostId, setPreviewStaffPostId] = useState<number | null>(
    null
  );
  const [previewPostType, setPreviewPostType] = useState<
    "staff" | "regular" | null
  >(null);
  const [previewTargetId, setPreviewTargetId] = useState<string | null>(null);
  const [savedGrants, setSavedGrants] = useState<any[]>([]);
  const [savedForums, setSavedForums] = useState<any[]>([]);
  const [savedEurekaResponses, setSavedEurekaResponses] = useState<any[]>([]);
  const [bookmarkedPostIds, setBookmarkedPostIds] = useState<
    Set<string | number>
  >(new Set());
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const {
    categories,
    fetchCategories,
    createCategory,
    addPostToCategory,
    removePostFromCategory,
    loading: categoriesLoading,
    deleteCategory,
  } = useSavedCategories(userId);
  const [activeAddCategoryId, setActiveAddCategoryId] = useState<number | null>(
    null
  );
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(
    null
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );
  const [toggledCategoryPostIds, setToggledCategoryPostIds] = useState<
    Set<number | string>
  >(new Set());

  // Unbookmark confirmation dialog state
  const [unbookmarkDialogOpen, setUnbookmarkDialogOpen] = useState(false);
  const [itemToUnbookmark, setItemToUnbookmark] = useState<{
    id: number | string;
    title: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    if (!activeAddCategoryId) {
      setToggledCategoryPostIds(new Set());
      return;
    }
    const cat = categories.find((c) => c.id === activeAddCategoryId);
    if (cat && cat.posts) {
      // Use the same logic as allCategoryRepostIds for consistency
      setToggledCategoryPostIds(
        new Set(cat.posts.map((p: any) => p.targetId || p.id || p.postId))
      );
    } else {
      setToggledCategoryPostIds(new Set());
    }
  }, [activeAddCategoryId, categories]);

  const allCategoryStaffPostIds = [
    ...categories
      .flatMap((cat) => cat.staffPosts || [])
      .map((s: any) => s.targetId || s.id),
  ];
  const allCategoryRepostIds = [
    ...categories
      .flatMap((cat) => cat.posts || [])
      .map((p: any) => p.targetId || p.id || p.postId),
  ];
  const allCategoryGrantIds = [
    ...categories
      .flatMap((cat) => cat.grants || [])
      .map((g: any) => g.targetId || g.grantId),
  ];
  const allCategoryEurekaResponseIds = [
    ...categories
      .flatMap((cat) => cat.staffPosts || [])
      .filter(
        (p: any) =>
          p.type === "eureka_response" ||
          p.type === "eureka_result" ||
          p.targetType === "eureka_response" ||
          p.targetType === "eureka_result"
      )
      .map((p: any) => p.targetId || p.id),
  ];

  console.log(" Debug filtering:", {
    totalSavedPosts: savedPosts.length,
    totalSavedForums: savedForums.length,
    allCategoryStaffPostIds,
    allCategoryRepostIds,
    categories: categories.map((cat) => ({
      name: cat.name,
      staffPosts: cat.staffPosts?.length || 0,
      posts: cat.posts?.length || 0,
      postTargetIds: cat.posts?.map((p: any) => p.targetId) || [],
      postDetails:
        cat.posts?.map((p: any) => ({
          targetId: p.targetId,
          id: p.id,
          postId: p.postId,
          type: p.type,
        })) || [],
    })),
    categoriesLoaded: categories.length > 0,
    savedPostsLoaded: savedPosts.length > 0,
    savedForumsLoaded: savedForums.length > 0,
  });

  // Function to refresh saved content
  const refreshSavedContent = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/saved-content/mongodb?userId=${userId}`);
      const data = await res.json();
      console.log(" Refreshed saved content data:", data);

      // Update staff posts
      const staffPosts =
        data.bookmarks?.map((b: any) => b.staffPost).filter(Boolean) || [];
      setSavedPosts(
        staffPosts.sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );

      // Update forum posts
      const forumPosts =
        data.bookmarks?.map((b: any) => b.post).filter(Boolean) || [];
      setSavedForums(
        forumPosts.sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );

      // Update grants
      const grants =
        data.bookmarks?.map((b: any) => b.grant).filter(Boolean) || [];
      setSavedGrants(
        grants.sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      );

      // Update Eureka responses
      const eurekaResponses = data.eurekaResponses || [];
      setSavedEurekaResponses(
        eurekaResponses.sort(
          (a: any, b: any) =>
            new Date(b.timestamp || b.addedAt || b.createdAt).getTime() -
            new Date(a.timestamp || a.addedAt || a.createdAt).getTime()
        )
      );

      const postIds = new Set([
        ...data.bookmarks?.map((b: any) => b.targetId).filter(Boolean),
      ]);
      setBookmarkedPostIds(postIds);
    } catch (error) {
      console.error("Error refreshing saved content:", error);
    }
  };

  // Only filter if both categories and saved posts are loaded
  const unsortedSavedPosts = savedPosts.filter((post) => {
    // If categories aren't loaded yet, show all posts
    if (categories.length === 0) {
      console.log(" Categories not loaded yet, showing post:", post.title);
      return true;
    }

    const postId = post.targetId || post.id;
    const isInProject = allCategoryStaffPostIds.includes(postId);

    // Also check if the post is actually in any project by looking at the categories
    const isActuallyInProject = categories.some((cat) =>
      cat.staffPosts?.some(
        (staffPost: any) => (staffPost.targetId || staffPost.id) === postId
      )
    );

    console.log(" Post filtering:", {
      postId,
      isInProject,
      isActuallyInProject,
      postTitle: post.title,
      shouldShow: !isActuallyInProject,
    });

    return !isActuallyInProject;
  });
  const unsortedSavedGrants = savedGrants.filter(
    (grant) => !allCategoryGrantIds.includes(grant.targetId || grant.id)
  );
  const unsortedSavedEurekaResponses = savedEurekaResponses.filter(
    (eurekaResponse) => {
      // If categories aren't loaded yet, show all Eureka responses
      if (categories.length === 0) {
        return true;
      }

      const eurekaId = eurekaResponse.targetId || eurekaResponse.id;
      const isInProject = allCategoryEurekaResponseIds.includes(eurekaId);

      // Also check if the Eureka response is actually in any project
      const isActuallyInProject = categories.some((cat) =>
        cat.staffPosts?.some(
          (item: any) =>
            (item.type === "eureka_response" ||
              item.type === "eureka_result" ||
              item.targetType === "eureka_response" ||
              item.targetType === "eureka_result") &&
            (item.targetId || item.id) === eurekaId
        )
      );

      return !isActuallyInProject;
    }
  );

  const unsortedSavedForums = savedForums.filter((post) => {
    // If categories aren't loaded yet, show all forums
    if (categories.length === 0) {
      return true;
    }

    // First, filter out reposts that don't have a valid postId
    if (!post.postId) {
      console.log(" Filtering out repost with null postId:", {
        postId: post.id,
        targetId: post.targetId,
        postPostId: post.postId,
        type: post.type,
      });
      return false;
    }

    // Check multiple possible ID fields for reposts
    const postId = post.targetId || post.id || post.postId;
    const isInProject = allCategoryRepostIds.includes(postId);

    // Also check if the post is actually in any project by looking at the categories
    const isActuallyInProject = categories.some((cat) =>
      cat.posts?.some((repost: any) => {
        const repostId = repost.targetId || repost.id || repost.postId;
        return repostId === postId;
      })
    );

    console.log(" Forum filtering:", {
      postId,
      postTargetId: post.targetId,
      postIdField: post.id,
      postPostId: post.postId,
      isInProject,
      isActuallyInProject,
      shouldShow: !isActuallyInProject,
    });

    return !isActuallyInProject;
  });

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/saved-content/mongodb?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        console.log(" Saved content data received:", data);
        const staffPosts =
          data.bookmarks?.map((b: any) => b.staffPost).filter(Boolean) || [];
        console.log(" Processed staff posts:", staffPosts.length);
        setSavedPosts(
          staffPosts.sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        const forumPosts =
          data.bookmarks?.map((b: any) => b.post).filter(Boolean) || [];
        console.log(
          " Forum posts from API:",
          forumPosts.map((p: any) => ({
            id: p.id,
            targetId: p.targetId,
            postId: p.postId,
            userId: p.userId,
            content: p.content?.substring(0, 30) + "...",
            type: p.type,
            keys: Object.keys(p),
          }))
        );
        setSavedForums(
          forumPosts.sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        const grants = data.grants || [];
        setSavedGrants(
          grants.sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        const eurekaResponses = data.eurekaResponses || [];
        console.log(" Eureka responses from API:", eurekaResponses.length);
        setSavedEurekaResponses(
          eurekaResponses.sort(
            (a: any, b: any) =>
              new Date(b.timestamp || b.addedAt || b.createdAt).getTime() -
              new Date(a.timestamp || a.addedAt || a.createdAt).getTime()
          )
        );
        const postIds = new Set([
          ...data.bookmarks?.map((b: any) => b.targetId).filter(Boolean),
        ]);
        setBookmarkedPostIds(postIds);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetchCategories(); // Restore this so categories load on mount/refresh
  }, [userId, fetchCategories]);

  // Force re-filtering when categories are loaded
  useEffect(() => {
    if (categories.length > 0 && savedPosts.length > 0) {
      console.log(" Categories loaded, re-filtering saved posts");
      // This will trigger a re-render and re-filter
    }
  }, [categories, savedPosts]);

  const handleOpenCategoryModal = () => {
    setNewCategoryName("");
    setCategoryError("");
    setCategoryModalOpen(true);
    // Call the prop if provided (for external triggering)
    if (onOpenCategoryModal) {
      onOpenCategoryModal();
    }
  };
  const handleCloseCategoryModal = () => {
    setCategoryModalOpen(false);
    setNewCategoryName("");
    setCategoryError("");
  };
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryError("Category name cannot be empty");
      return;
    }
    await createCategory(newCategoryName.trim());
    setCategoryModalOpen(false);
    setNewCategoryName("");
    setCategoryError("");
    // Remove the setTimeout call to prevent race condition with duplicate categories
  };

  const removeGrantFromCategory = async (
    categoryId: number,
    grantId: number
  ) => {
    await fetch("/api/saved-categories/mongodb", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, targetId: grantId.toString() }),
    });
  };

  // Keep the old function for backward compatibility but make it use the new unified function
  const handleUnbookmarkGrant = async (grantId: string) => {
    return showUnbookmarkConfirmation(grantId);
  };

  // Unified unbookmark function that can handle all content types
  const handleUnbookmarkItem = async (itemId: number | string) => {
    try {
      console.log(" Starting unbookmark process for item:", {
        itemId,
        userId: session?.userId,
      });

      // First, try to find in saved posts (staff posts and MongoDB papers)
      let savedItem = savedPosts.find((p) => p.id === itemId);
      let targetId, targetType;

      if (savedItem) {
        targetId = savedItem.targetId || savedItem.staffPost?.targetId;
        targetType = savedItem.targetType || "staff_post";

        // Auto-detect target type based on targetId format
        if (targetId && typeof targetId === "string") {
          if (targetId.startsWith("openalex:")) {
            targetType = "mongodb_paper";
          } else if (
            targetId.length === 24 &&
            /^[0-9a-fA-F]{24}$/.test(targetId)
          ) {
            targetType = "mongodb_paper";
          }
        }

        console.log(" Found in saved posts:", { targetId, targetType });
      } else {
        // Try to find in saved forums (reposts)
        const savedForum = savedForums.find((f) => f.id === itemId);
        if (savedForum) {
          savedItem = savedForum;
          targetId = savedForum.targetId || itemId.toString();
          targetType = savedForum.targetType || "repost";
          console.log(" Found in saved forums:", { targetId, targetType });
        }
      }

      if (!savedItem || !targetId) {
        console.error(" Could not find saved item for unbookmark:", itemId);
        return;
      }

      console.log(" Using targetId and targetType for unbookmark:", {
        targetId,
        targetType,
      });

      // Remove from bookmarks
      const response = await fetch("/api/mongodb/bookmarks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session?.userId,
          targetId: targetId,
          targetType: targetType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(" Failed to unbookmark item:", errorData);
        throw new Error(errorData.error || "Failed to unbookmark item");
      }

      const result = await response.json();
      console.log(" Successfully unbookmarked item:", result);

      // Remove from all projects (handle different content types)
      for (const category of categories) {
        let shouldRemove = false;

        if (targetType === "staff_post" || targetType === "mongodb_paper") {
          shouldRemove = category.staffPosts?.some(
            (s: any) => s.targetId === targetId || s.id === targetId
          );
        } else if (targetType === "repost") {
          shouldRemove = category.posts?.some(
            (p: any) => p.targetId === targetId || p.id === targetId
          );
        } else if (targetType === "grant") {
          shouldRemove = category.grants?.some(
            (g: any) => g.targetId === targetId || g.grantId === targetId
          );
        }

        if (shouldRemove) {
          console.log(" Removing from project:", category.name);
          await removePostFromCategory(category.id, targetId, targetType);
        }
      }

      // Delete the note for this item since it's being unbookmarked
      try {
        const noteType =
          targetType === "staff_post" || targetType === "mongodb_paper"
            ? "staffPost"
            : targetType === "repost"
              ? "repost"
              : "grant";

        await fetch("/api/saved-notes", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: session?.userId,
            type: noteType,
            contentId: typeof itemId === "string" ? parseInt(itemId) : itemId,
          }),
        });
        console.log(" Note deleted for unbookmarked item:", itemId);
      } catch (noteError) {
        console.log(" Note deletion failed (may not exist):", noteError);
      }

      // Update the appropriate state based on content type
      if (targetType === "staff_post" || targetType === "mongodb_paper") {
        setSavedPosts((prev) => prev.filter((p) => p.targetId !== targetId));
      } else if (targetType === "repost") {
        setSavedForums((prev) => prev.filter((f) => f.targetId !== targetId));
      } else if (targetType === "grant") {
        setSavedGrants((prev) => prev.filter((g) => g.targetId !== targetId));
      }

      // Dispatch custom event to notify other bookmark buttons of the change
      const bookmarkChangeEvent = new CustomEvent("bookmarkChanged", {
        detail: {
          targetId: targetId,
          targetType: targetType,
          bookmarked: false,
        },
      });
      window.dispatchEvent(bookmarkChangeEvent);

      // Refresh categories to update the UI
      fetchCategories();

      // Also refresh saved content to ensure consistency
      setTimeout(() => {
        refreshSavedContent();
      }, 100);
    } catch (error) {
      console.error(" Error unbookmarking item:", error);
      // If unbookmark failed, refresh saved content to restore correct state
      refreshSavedContent();
    }
  };

  // Function to show unbookmark confirmation dialog
  const showUnbookmarkConfirmation = (itemId: number | string) => {
    // Find the item to get its title and type
    let item = savedPosts.find((p) => p.id === itemId);
    let itemTitle = "Unknown Item";
    let itemType = "item";

    if (item) {
      itemTitle = item.staffPost?.title || item.title || "Unknown Post";
      itemType = item.targetType === "mongodb_paper" ? "paper" : "post";
    } else {
      // Try to find in saved forums
      const forum = savedForums.find((f) => f.id === itemId);
      if (forum) {
        itemTitle =
          forum.title ||
          forum.content?.substring(0, 50) + "..." ||
          "Unknown Forum";
        itemType = "forum";
      } else {
        // Try to find in saved grants
        const grant = savedGrants.find((g) => g.id === itemId);
        if (grant) {
          itemTitle = grant.title || "Unknown Grant";
          itemType = "grant";
        }
      }
    }

    setItemToUnbookmark({
      id: itemId,
      title: itemTitle,
      type: itemType,
    });
    setUnbookmarkDialogOpen(true);
  };

  // Function to confirm unbookmark
  const confirmUnbookmark = async () => {
    if (itemToUnbookmark) {
      await handleUnbookmarkItem(itemToUnbookmark.id);
      setUnbookmarkDialogOpen(false);
      setItemToUnbookmark(null);
    }
  };

  // Function to cancel unbookmark
  const cancelUnbookmark = () => {
    setUnbookmarkDialogOpen(false);
    setItemToUnbookmark(null);
  };

  // Keep the old function for backward compatibility but make it use the new unified function
  const handleUnbookmarkPost = async (postId: number | string) => {
    return showUnbookmarkConfirmation(postId);
  };

  // Keep the old function for backward compatibility but make it use the new unified function
  const handleUnbookmarkForum = async (postId: number | string) => {
    return showUnbookmarkConfirmation(postId);
  };
  const handleRemoveForumFromCategory = (postId: number | string) => {
    // Remove forum from the active category
    if (activeAddCategoryId) {
      removePostFromCategory(activeAddCategoryId, postId, "repost")
        .then(() => {
          // Update the toggled list to show the forum as removed
          setToggledCategoryPostIds((prev) => {
            const next = new Set(prev);
            next.delete(postId);
            return next;
          });
        })
        .catch((error) => {
          console.error("Error removing forum from category:", error);
        });
    }
  };

  const handleRemoveGrantFromCategory = (grantId: string) => {
    // Remove grant from the active category
    if (activeAddCategoryId) {
      removePostFromCategory(activeAddCategoryId, grantId, "grant")
        .then(() => {
          // Update the toggled list to show the grant as removed
          setToggledCategoryPostIds((prev) => {
            const next = new Set(prev);
            next.delete(grantId);
            return next;
          });
        })
        .catch((error) => {
          console.error("Error removing grant from category:", error);
        });
    }
  };

  const handleGrantComment = (grantId: string) => {
    console.log("handleGrantComment called with grantId:", grantId);

    // For grants, we use the grant ID directly for comments
    // The comment system expects a targetId in the format "grant:grantId"
    const targetId = `grant:${grantId}`;

    console.log(" Setting grant comment preview with targetId:", targetId);
    setPreviewPostId(grantId);
    setPreviewPostType("regular");
    setPreviewTargetId(targetId);
  };

  const handleGrantForum = (grantId: string) => {
    console.log("handleGrantForum called with grantId:", grantId);

    // Navigate to the grant forum page
    router.push(`/forum/grants/${grantId}`);
  };

  // Handle open forum for saved content - extract numbers after 'W' from targetId
  const handleOpenForum = (postId: number | string) => {
    console.log(" handleOpenForum called with postId:", postId);
    console.log(" handleOpenForum - savedForums length:", savedForums.length);
    console.log(" handleOpenForum - savedPosts length:", savedPosts.length);

    // Find the saved item to get the targetId
    const savedForum = savedForums.find((f) => f.id === postId);
    const savedPost = savedPosts.find((p) => p.id === postId);
    const savedItem = savedForum || savedPost;

    if (savedItem && savedItem.targetId) {
      // Check if this is a repost
      if (savedItem.type === "repost" && savedItem.postId) {
        // For reposts, navigate directly to the repost's forum page
        console.log(
          " Repost detected, navigating to repost forum:",
          savedItem.postId
        );
        router.push(`/forum/${savedItem.postId}`);
      } else {
        // For regular forum posts, extract the numbers after 'W' from the targetId
        // targetId: "openalex:https://openalex.org/W1971440513"
        // Extract: "1971440513"
        const match = savedItem.targetId.match(/W(\d+)/);
        if (match) {
          const forumId = match[1]; // "1971440513"
          console.log(" Extracted forum ID from targetId:", forumId);
          console.log(" Navigating to forum page:", `/forum/${forumId}`);
          router.push(`/forum/${forumId}`);
        } else {
          console.log(
            " Could not extract forum ID from targetId:",
            savedItem.targetId
          );
          // Fallback to staff forum
          router.push(`/forum/staff/${postId}`);
        }
      }
    } else {
      // Fallback to staff forum if no targetId found
      console.log(" No targetId found, navigating to staff forum:", postId);
      router.push(`/forum/staff/${postId}`);
    }
  };

  const handleComment = (postId: number | string) => {
    console.log(
      "handleComment called with postId:",
      postId,
      "type:",
      typeof postId
    );

    // Find the actual saved forum data to understand its structure
    console.log(" All saved forums:", savedForums);
    console.log(" All saved posts:", savedPosts);
    const savedForum = savedForums.find((f) => f.id === postId);
    const savedPost = savedPosts.find((p) => p.id === postId);
    console.log(" Found saved forum data:", savedForum);
    console.log(" Found saved post data:", savedPost);
    console.log(
      " Looking for postId:",
      postId,
      "in savedForums with IDs:",
      savedForums.map((f) => f.id)
    );
    console.log(
      " Looking for postId:",
      postId,
      "in savedPosts with IDs:",
      savedPosts.map((p) => p.id)
    );

    // For saved content, we need to get the targetId from the bookmark data
    // The postId is the generatedNumericId, but we need the actual targetId for comments
    const savedItem = savedForum || savedPost;
    console.log(" savedItem found:", savedItem);
    console.log(" savedItem?.targetId:", savedItem?.targetId);

    if (savedItem && savedItem.targetId) {
      // Check if this is a repost
      if (savedItem.type === "repost" && savedItem.postId) {
        // For reposts, use unique identifier instead of shared targetId
        console.log(" Repost detected, using unique identifier");
        setPreviewPostId(savedItem.postId);
        setPreviewPostType("regular");
        setPreviewTargetId(`repost:${savedItem.postId}`);
      } else {
        // For other content types, use the targetId from the saved item data
        const targetId = savedItem.targetId;
        console.log(" Using targetId from saved item data:", targetId);

        // Extract the numeric ID from the targetId for the preview
        const numericId = parseInt(targetId.replace(/\D/g, ""));
        console.log(
          " Setting preview with targetId:",
          targetId,
          "numericId:",
          numericId
        );

        setPreviewPostId(numericId);
        setPreviewPostType("regular");
        setPreviewTargetId(targetId);
      }
    } else {
      // Fallback to the old logic if no targetId is available
      console.log(" No targetId found, using fallback logic");

      const isMongoDBPaper =
        typeof postId === "string" ||
        (typeof postId === "number" && postId > 1000000000);

      console.log(" Is MongoDB paper:", isMongoDBPaper, "postId:", postId);

      if (isMongoDBPaper) {
        // MongoDB paper - convert to a number for preview
        const numericId =
          typeof postId === "string"
            ? parseInt(postId.replace(/\D/g, ""))
            : postId;
        console.log(" Setting preview for MongoDB paper with ID:", numericId);
        setPreviewPostId(numericId);
        setPreviewPostType("regular");
        setPreviewTargetId(null);
      } else {
        // Staff post - ensure it's a number
        const numericId =
          typeof postId === "string" ? parseInt(postId, 10) : postId;
        console.log(" Setting preview for staff post with ID:", numericId);
        setPreviewStaffPostId(numericId);
        setPreviewPostType("staff");
        setPreviewTargetId(null);
      }
    }
  };

  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(max-width:600px)").matches;

  return (
    <Box
      sx={{
        width: "100%",
        bgcolor: "transparent",
        py: 0,
        px: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Sticky Top Bar with Category Bubbles */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 2001,
          bgcolor: "#f7f9fb",
          borderBottom: "1.5px solid #e0e3e8",
          width: "100%",
          py: isMobile ? 3 : 4,
          px: isMobile ? 3 : 2,
          mb: 2,
          mt: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          overflowX: isMobile ? "visible" : "visible",
          whiteSpace: isMobile ? "normal" : "nowrap",
        }}
      >
        {/* Mobile: Create New Project Button at Top */}
        {isMobile && (
          <Box sx={{ mb: 3, width: "100%" }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenCategoryModal}
              fullWidth
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                textTransform: "none",
                py: 1.5,
                fontSize: "1rem",
              }}
            >
              Create New Project
            </Button>
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 2 : 2,
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: isMobile ? "flex-start" : "center",
            width: "100%",
          }}
        >
          {categories.map((cat, index) => (
            <Box
              key={`${cat.id}-${index}`}
              sx={{
                display: "flex",
                flexDirection: "row", // Always horizontal for mobile
                alignItems: "center",
                borderRadius: isMobile ? 3 : 2,
                bgcolor: selectedCategoryId === cat.id ? "#1976d2" : "#e3f0fd",
                color: selectedCategoryId === cat.id ? "#fff" : "#1976d2",
                fontWeight: 600,
                fontSize: isMobile ? "1.1rem" : 16,
                px: isMobile ? 2 : 2,
                py: isMobile ? 2 : 1,
                boxShadow: selectedCategoryId === cat.id ? 2 : 0,
                mr: isMobile ? 0 : 1,
                minWidth: 0,
                maxWidth: isMobile ? 330 : 260,
                width: isMobile ? "100%" : "auto",
                minHeight: isMobile ? 60 : "auto", // Reduced height for horizontal layout
                transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
                cursor: isMobile ? "pointer" : "default",
              }}
              onClick={
                isMobile
                  ? () =>
                      setSelectedCategoryId(
                        selectedCategoryId === cat.id ? null : cat.id
                      )
                  : undefined
              }
            >
              <Box
                sx={{
                  flex: isMobile ? "0 1 auto" : 1, // Don't take up all space on mobile
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap", // Keep text on one line
                  cursor: isMobile ? "default" : "pointer",
                  textAlign: "left",
                  fontSize: isMobile ? "1.2rem" : "inherit",
                  fontWeight: isMobile ? 700 : 600,
                  mr: isMobile ? 1 : 0, // Add some margin for spacing
                }}
                onClick={
                  isMobile
                    ? undefined
                    : () =>
                        setSelectedCategoryId(
                          selectedCategoryId === cat.id ? null : cat.id
                        )
                }
                tabIndex={isMobile ? -1 : 0}
                role={isMobile ? undefined : "button"}
                aria-label={
                  isMobile ? undefined : `Select category ${cat.name}`
                }
                aria-pressed={
                  isMobile ? undefined : selectedCategoryId === cat.id
                }
              >
                {cat.name}
              </Box>
              {!isMobile && (
                <ProjectNoteButton
                  categoryId={cat.id}
                  categoryName={cat.name}
                  onNoteUpdate={fetchCategories}
                  size="small"
                />
              )}
              {/* Mobile: Buttons in horizontal line with the name */}
              {isMobile && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5, // Reduced gap between buttons
                    flexShrink: 0, // Prevent buttons from shrinking
                  }}
                >
                  <IconButton
                    size="small"
                    sx={{
                      bgcolor:
                        activeAddCategoryId === cat.id ? "#1976d2" : "#f5f8fd",
                      color:
                        activeAddCategoryId === cat.id ? "#fff" : "#1976d2",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      minWidth: 28,
                      minHeight: 28,
                      boxShadow:
                        activeAddCategoryId === cat.id
                          ? "0 4px 16px rgba(25, 118, 210, 0.15)"
                          : "0 2px 8px rgba(25, 118, 210, 0.07)",
                      transition:
                        "background 0.18s, color 0.18s, box-shadow 0.18s",
                      "&:hover": {
                        bgcolor:
                          activeAddCategoryId === cat.id
                            ? "#1251a3"
                            : "#e3f0fd",
                        boxShadow: "0 6px 20px rgba(25, 118, 210, 0.18)",
                      },
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveAddCategoryId(
                        activeAddCategoryId === cat.id ? null : cat.id
                      );
                    }}
                    aria-label={
                      activeAddCategoryId === cat.id
                        ? "Cancel add mode"
                        : "Enable add mode"
                    }
                    aria-pressed={activeAddCategoryId === cat.id}
                  >
                    <AddIcon
                      fontSize="medium"
                      style={{
                        color:
                          activeAddCategoryId === cat.id ? "#fff" : "#1976d2",
                      }}
                    />
                  </IconButton>

                  <IconButton
                    size="small"
                    sx={{
                      bgcolor: "#fff",
                      color: "#d32f2f",
                      borderRadius: "50%",
                      boxShadow: "0 1px 4px rgba(211,47,47,0.08)",
                      transition: "background 0.18s, color 0.18s",
                      "&:hover": {
                        bgcolor: "#fbe9e7",
                        boxShadow: "0 2px 8px rgba(211,47,47,0.12)",
                      },
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      minWidth: 28,
                      minHeight: 28,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryToDelete(cat);
                      setDeleteDialogOpen(true);
                    }}
                    aria-label="Delete category"
                  >
                    <DeleteOutlineIcon fontSize="medium" />
                  </IconButton>

                  <ProjectNoteButton
                    categoryId={cat.id}
                    categoryName={cat.name}
                    onNoteUpdate={fetchCategories}
                    size="small"
                  />
                </Box>
              )}

              {/* Desktop: Original button layout */}
              {!isMobile && (
                <>
                  <IconButton
                    size="small"
                    sx={{
                      bgcolor:
                        activeAddCategoryId === cat.id ? "#1976d2" : "#f5f8fd",
                      color:
                        activeAddCategoryId === cat.id ? "#fff" : "#1976d2",
                      borderRadius: "50%",
                      ml: 1,
                      mr: 1,
                      width: 28,
                      height: 28,
                      minWidth: 28,
                      minHeight: 28,
                      boxShadow:
                        activeAddCategoryId === cat.id
                          ? "0 4px 16px rgba(25, 118, 210, 0.15)"
                          : "0 2px 8px rgba(25, 118, 210, 0.07)",
                      transition:
                        "background 0.18s, color 0.18s, box-shadow 0.18s",
                      "&:hover": {
                        bgcolor:
                          activeAddCategoryId === cat.id
                            ? "#1251a3"
                            : "#e3f0fd",
                        boxShadow: "0 6px 20px rgba(25, 118, 210, 0.18)",
                      },
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveAddCategoryId(
                        activeAddCategoryId === cat.id ? null : cat.id
                      );
                    }}
                    aria-label={
                      activeAddCategoryId === cat.id
                        ? "Cancel add mode"
                        : "Enable add mode"
                    }
                    aria-pressed={activeAddCategoryId === cat.id}
                  >
                    <AddIcon
                      fontSize="medium"
                      style={{
                        color:
                          activeAddCategoryId === cat.id ? "#fff" : "#1976d2",
                      }}
                    />
                  </IconButton>
                  <IconButton
                    size="small"
                    sx={{
                      bgcolor: "#fff",
                      color: "#d32f2f",
                      borderRadius: "50%",
                      ml: 0.5,
                      boxShadow: "0 1px 4px rgba(211,47,47,0.08)",
                      transition: "background 0.18s, color 0.18s",
                      "&:hover": {
                        bgcolor: "#fbe9e7",
                        boxShadow: "0 2px 8px rgba(211,47,47,0.12)",
                      },
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      minWidth: 28,
                      minHeight: 28,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryToDelete(cat);
                      setDeleteDialogOpen(true);
                    }}
                    aria-label="Delete category"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          ))}

          {/* Desktop: Create New Project Button */}
          {!isMobile && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenCategoryModal}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                textTransform: "none",
                ml: 2,
                px: 2,
                py: 1,
                height: 40,
              }}
            >
              Create New Project
            </Button>
          )}
        </Box>
      </Box>
      {/* Selected Project Posts (same layout as unsorted) */}
      {selectedCategoryId && (
        <Box
          sx={{
            width: "100%",
            mb: 4,
            p: 0,
            bgcolor: "#e3f0fd",
            borderRadius: 0,
            boxShadow: 0,
          }}
        >
          <Box sx={{ width: "100%", pt: 3, pb: 3 }}>
            {categories
              .filter((cat) => cat.id === selectedCategoryId)
              .map((cat) => (
                <React.Fragment key={cat.id}>
                  {/* Bookmarked Grants */}
                  {(cat.grants || []).length > 0 && (
                    <Box sx={{ width: "100%", mb: 4 }}>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 700,
                          color: "#1976d2",
                          mb: 2,
                          pl: 4,
                        }}
                      >
                        Grants
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          gap: isMobile ? 2 : 4,
                          overflowX: "auto",
                          pb: 2,
                          pl: 4,
                          pr: 8, // Increased right padding to ensure full visibility
                        }}
                      >
                        {(cat.grants || []).map((g: any) => (
                          <Box
                            key={g.grantId}
                            sx={{
                              width: isMobile ? "100vw" : 600,
                              minWidth: isMobile ? "100vw" : 600,
                              maxWidth: isMobile ? "100vw" : 600,
                              flexShrink: 0,
                              position: "relative",
                            }}
                          >
                            <GrantCard
                              grant={g.grant}
                              onOpenForum={() =>
                                router.push(`/forum/grants/${g.grantId}`)
                              }
                              onComment={() => setPreviewPostId(g.grantId)}
                              headerIcons={
                                <Box
                                  sx={{
                                    display: "flex",
                                    gap: 1,
                                    justifyContent: "flex-end",
                                  }}
                                >
                                  <IconButton
                                    size="small"
                                    sx={{
                                      bgcolor: "#fbe9e7",
                                      color: "#d32f2f",
                                      boxShadow: 1,
                                    }}
                                    aria-label="Remove from project"
                                    onClick={async () => {
                                      try {
                                        await removePostFromCategory(
                                          cat.id,
                                          g.grantId,
                                          "grant"
                                        );

                                        // Ensure the grant remains bookmarked after removing from project
                                        const isInSavedArea = savedGrants.some(
                                          (savedGrant: any) =>
                                            savedGrant.targetId === g.grantId
                                        );

                                        // If the grant is not in the saved area, explicitly add it to bookmarks
                                        if (!isInSavedArea) {
                                          console.log(
                                            " Adding grant to bookmarks after project removal:",
                                            g.grantId
                                          );
                                          try {
                                            const response = await fetch(
                                              "/api/mongodb/bookmarks",
                                              {
                                                method: "POST",
                                                headers: {
                                                  "Content-Type":
                                                    "application/json",
                                                },
                                                body: JSON.stringify({
                                                  userId: session?.userId,
                                                  targetId: g.grantId,
                                                  targetType:
                                                    g.targetType || "grant",
                                                  completeData: g,
                                                }),
                                              }
                                            );

                                            const data = await response.json();

                                            if (response.ok) {
                                              console.log(
                                                " Grant successfully bookmarked after project removal:",
                                                data.message
                                              );
                                            } else {
                                              console.log(
                                                " Failed to bookmark grant after project removal:",
                                                data.error
                                              );
                                            }
                                          } catch (bookmarkError) {
                                            console.log(
                                              " Failed to bookmark grant after project removal (network error):",
                                              bookmarkError
                                            );
                                          }
                                        } else {
                                          console.log(
                                            " Grant already bookmarked, no action needed"
                                          );
                                        }

                                        // Update categories first, then refresh saved content
                                        await fetchCategories();
                                        // Small delay to ensure categories are updated before refreshing saved content
                                        setTimeout(() => {
                                          refreshSavedContent();
                                        }, 100);
                                      } catch (error) {
                                        console.error(
                                          "Error removing grant from project:",
                                          error
                                        );
                                      }
                                    }}
                                  >
                                    <RemoveIcon />
                                  </IconButton>
                                </Box>
                              }
                            />
                          </Box>
                        ))}
                        {/* Spacer to ensure full visibility of the last grant */}
                        <Box
                          sx={{
                            width: isMobile ? 20 : 40,
                            minWidth: isMobile ? 20 : 40,
                            flexShrink: 0,
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                  {/* Bookmarked Posts (StaffPosts) */}
                  {((cat.posts || []).filter(
                    (p: any) => !p.type || p.type === "staffPost"
                  ).length > 0 ||
                    (cat.staffPosts || []).length > 0) && (
                    <Box sx={{ width: "100%", mb: 2 }}>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 700,
                          color: "#1976d2",
                          mb: 2,
                          pl: 4,
                        }}
                      >
                        Posts
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "row",
                          flexWrap: "nowrap",
                          gap: isMobile ? 2 : 45,
                          overflowX: "auto",
                          pb: 2,
                          pl: 4,
                          pr: 8, // Increased right padding to ensure full visibility
                        }}
                      >
                        {[
                          ...(Array.isArray(cat.posts || [])
                            ? (cat.posts || []).filter(
                                (post: any) =>
                                  !post.type || post.type === "staffPost"
                              )
                            : []),
                          ...(Array.isArray(cat.staffPosts || [])
                            ? cat.staffPosts || []
                            : []),
                        ]
                          .filter(
                            (post: any) =>
                              post.type !== "eureka_response" &&
                              post.type !== "eureka_result" &&
                              post.targetType !== "eureka_response" &&
                              post.targetType !== "eureka_result"
                          )
                          .map((post: any) => (
                            <Box
                              key={post.id}
                              sx={{
                                width: isMobile ? "100vw" : 600,
                                minWidth: isMobile ? "100vw" : 600,
                                maxWidth: isMobile ? "100vw" : 600,
                                flexShrink: 0,
                                position: "relative",
                              }}
                            >
                              <StaffPostCard
                                post={post.staffPost || post}
                                hideRepostButton={false} // FIXED: Show repost button like in home feed
                                showBookmark={true}
                                onOpenForum={() =>
                                  handleOpenForum(post.staffPost?.id || post.id)
                                }
                                onComment={() => {
                                  const commentId =
                                    post.staffPost?.id || post.id;
                                  console.log(
                                    " Comment button clicked in project area:",
                                    {
                                      postId: post.id,
                                      staffPostId: post.staffPost?.id,
                                      targetId: post.targetId,
                                      finalCommentId: commentId,
                                      postData: post,
                                    }
                                  );
                                  handleComment(commentId);
                                }}
                                bookmarked={
                                  bookmarkedPostIds.has(
                                    post.staffPost?.id || post.id
                                  ) ||
                                  allCategoryStaffPostIds.includes(
                                    post.staffPost?.id || post.id
                                  )
                                }
                                onUnbookmark={async () => {
                                  // Use the centralized unbookmark function
                                  await handleUnbookmarkPost(
                                    post.targetId ||
                                      post.staffPost?.targetId ||
                                      post.id
                                  );
                                }}
                                headerIcons={
                                  <Box
                                    sx={{
                                      display: "flex",
                                      gap: 1,
                                      justifyContent: "flex-end",
                                      mr: 6,
                                    }}
                                  >
                                    <IconButton
                                      size="small"
                                      sx={{
                                        bgcolor: "#fbe9e7",
                                        color: "#d32f2f",
                                        boxShadow: 1,
                                      }}
                                      aria-label="Remove from project"
                                      onClick={async () => {
                                        try {
                                          // Remove from project using MongoDB API
                                          // Use the actual targetType from the stored data
                                          console.log(
                                            " Post data for removal:",
                                            {
                                              postId: post.id,
                                              postType: post.type,
                                              targetId: post.targetId,
                                              staffPostId: post.staffPost?.id,
                                              postData: post,
                                            }
                                          );

                                          // Use the actual targetType from the stored data, not a hardcoded value
                                          const targetType =
                                            post.targetType ||
                                            (post.type === "repost"
                                              ? "repost"
                                              : "staff_post");
                                          await removePostFromCategory(
                                            cat.id,
                                            post.targetId || post.id,
                                            targetType
                                          );

                                          // Delete the note for this post since it's being removed from the project
                                          try {
                                            await fetch("/api/saved-notes", {
                                              method: "DELETE",
                                              headers: {
                                                "Content-Type":
                                                  "application/json",
                                              },
                                              body: JSON.stringify({
                                                userId,
                                                type: "staffPost",
                                                contentId:
                                                  post.staffPost?.id || post.id,
                                              }),
                                            });
                                            console.log(
                                              " Note deleted for post:",
                                              post.staffPost?.id || post.id
                                            );
                                          } catch (noteError) {
                                            console.log(
                                              " Note deletion failed (may not exist):",
                                              noteError
                                            );
                                          }

                                          // Ensure the post remains bookmarked after removing from project
                                          const isInSavedArea = savedPosts.some(
                                            (savedPost: any) =>
                                              savedPost.targetId ===
                                              (post.targetId || post.id)
                                          );

                                          // If the post is not in the saved area, explicitly add it to bookmarks
                                          if (!isInSavedArea) {
                                            console.log(
                                              " Adding post to bookmarks after project removal:",
                                              post.targetId || post.id
                                            );
                                            try {
                                              const response = await fetch(
                                                "/api/mongodb/bookmarks",
                                                {
                                                  method: "POST",
                                                  headers: {
                                                    "Content-Type":
                                                      "application/json",
                                                  },
                                                  body: JSON.stringify({
                                                    userId: session?.userId,
                                                    targetId:
                                                      post.targetId || post.id,
                                                    targetType:
                                                      post.targetType ||
                                                      "staff_post",
                                                    completeData:
                                                      post.staffPost || post,
                                                  }),
                                                }
                                              );

                                              const data =
                                                await response.json();

                                              if (response.ok) {
                                                console.log(
                                                  " Post successfully bookmarked after project removal:",
                                                  data.message
                                                );
                                              } else {
                                                console.log(
                                                  " Failed to bookmark post after project removal:",
                                                  data.error
                                                );
                                              }
                                            } catch (bookmarkError) {
                                              console.log(
                                                " Failed to bookmark post after project removal (network error):",
                                                bookmarkError
                                              );
                                            }
                                          } else {
                                            console.log(
                                              " Post already bookmarked, no action needed"
                                            );
                                          }

                                          // Update categories first, then refresh saved content
                                          await fetchCategories();
                                          // Small delay to ensure categories are updated before refreshing saved content
                                          setTimeout(() => {
                                            refreshSavedContent();
                                          }, 100);
                                        } catch (error) {
                                          console.error(
                                            "Error removing from project:",
                                            error
                                          );
                                        }
                                      }}
                                    >
                                      <RemoveIcon />
                                    </IconButton>
                                    <IndividualPostNoteButton
                                      type="staffPost"
                                      contentId={
                                        post.targetId ||
                                        post.staffPost?.targetId ||
                                        post.staffPost?.id ||
                                        post.id
                                      }
                                      contentTitle={
                                        post.staffPost?.title || post.title
                                      }
                                      onNoteUpdate={fetchCategories}
                                      size="small"
                                    />
                                    {(() => {
                                      console.log(" Post data for notes:", {
                                        postId: post.id,
                                        targetId: post.targetId,
                                        staffPostId: post.staffPost?.id,
                                        staffPostTargetId:
                                          post.staffPost?.targetId,
                                        finalContentId:
                                          post.targetId ||
                                          post.staffPost?.targetId ||
                                          post.staffPost?.id ||
                                          post.id,
                                      });
                                      return null;
                                    })()}
                                  </Box>
                                }
                              />
                            </Box>
                          ))}
                        {/* Spacer to ensure full visibility of the last staff post */}
                        <Box
                          sx={{
                            width: isMobile ? 20 : 40,
                            minWidth: isMobile ? 20 : 40,
                            flexShrink: 0,
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                  {/* Bookmarked Eureka Responses */}
                  {(cat.staffPosts || []).filter(
                    (p: any) =>
                      p.type === "eureka_response" ||
                      p.type === "eureka_result" ||
                      p.targetType === "eureka_response" ||
                      p.targetType === "eureka_result"
                  ).length > 0 && (
                    <Box sx={{ width: "100%", mb: 4, pl: 4, pr: 4 }}>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 700,
                          color: "#1976d2",
                          mb: 2,
                        }}
                      >
                        Eureka Responses
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        {(cat.staffPosts || [])
                          .filter(
                            (p: any) =>
                              p.type === "eureka_response" ||
                              p.type === "eureka_result" ||
                              p.targetType === "eureka_response" ||
                              p.targetType === "eureka_result"
                          )
                          .map((eurekaResponse: any) => {
                            const eurekaId =
                              eurekaResponse.targetId || eurekaResponse.id;
                            return (
                              <SavedEurekaResponseCard
                                key={
                                  eurekaResponse.id || eurekaResponse.targetId
                                }
                                eurekaResponse={eurekaResponse}
                                headerIcons={
                                  <Box
                                    sx={{
                                      display: "flex",
                                      gap: 1,
                                      justifyContent: "flex-end",
                                    }}
                                  >
                                    <IconButton
                                      size="small"
                                      sx={{
                                        bgcolor: "#fbe9e7",
                                        color: "#d32f2f",
                                        boxShadow: 1,
                                      }}
                                      aria-label="Remove from project"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          const targetType =
                                            eurekaResponse.targetType ||
                                            eurekaResponse.type ||
                                            "eureka_result";
                                          await removePostFromCategory(
                                            cat.id,
                                            eurekaId,
                                            targetType
                                          );
                                          await fetchCategories();
                                          setTimeout(() => {
                                            refreshSavedContent();
                                          }, 100);
                                        } catch (error) {
                                          console.error(
                                            "Error removing Eureka response from project:",
                                            error
                                          );
                                        }
                                      }}
                                    >
                                      <RemoveIcon />
                                    </IconButton>
                                  </Box>
                                }
                              />
                            );
                          })}
                      </Box>
                    </Box>
                  )}
                  {/* --- CATEGORY (SORTED) VIEW: Bookmarked Forums (Reposts) --- */}
                  {(() => {
                    const reposts = (cat.posts || []).filter(
                      (p: any) =>
                        p.type === "repost" &&
                        p.postId !== null &&
                        p.userFullName !== "User"
                    );
                    return (
                      <>
                        {reposts.length > 0 && (
                          <Box sx={{ width: "100%", mb: 4 }}>
                            <Typography
                              variant="h5"
                              sx={{
                                fontWeight: 700,
                                color: "#1976d2",
                                mb: 2,
                                pl: 4,
                              }}
                            >
                              Forums
                            </Typography>
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "row",
                                flexWrap: "nowrap",
                                gap: isMobile ? 2 : 52,
                                overflowX: "auto",
                                pb: 2,
                                pl: 4,
                                pr: 8, // Increased right padding to ensure full visibility
                              }}
                            >
                              {reposts.map((post: any) => {
                                console.log(
                                  " Repost data being passed to FeedCard:",
                                  {
                                    postId: post.id,
                                    userId: post.userId,
                                    userFullName: post.userFullName,
                                    hasUser: !!post.user,
                                    userKeys: post.user
                                      ? Object.keys(post.user)
                                      : null,
                                    postKeys: Object.keys(post),
                                    completeDataKeys: post.completeData
                                      ? Object.keys(post.completeData)
                                      : null,
                                    completeDataUserId:
                                      post.completeData?.userId,
                                    completeDataUser: post.completeData?.user,
                                  }
                                );
                                return (
                                  <Box
                                    key={post.id}
                                    sx={{
                                      width: isMobile ? "100vw" : 600,
                                      minWidth: isMobile ? "100vw" : 600,
                                      maxWidth: isMobile ? "100vw" : 600,
                                      flexShrink: 0,
                                      position: "relative",
                                    }}
                                  >
                                    <FeedCard
                                      post={post}
                                      userId={post.userId}
                                      bookmarked={
                                        bookmarkedPostIds.has(post.id) ||
                                        allCategoryRepostIds.includes(post.id)
                                      }
                                      onUnbookmark={async () => {
                                        // Remove from all projects
                                        for (const category of categories) {
                                          if (
                                            category.posts?.some(
                                              (p: any) => p.id === post.id
                                            )
                                          ) {
                                            await fetch(
                                              "/api/saved-categories",
                                              {
                                                method: "PATCH",
                                                headers: {
                                                  "Content-Type":
                                                    "application/json",
                                                },
                                                body: JSON.stringify({
                                                  categoryId: category.id,
                                                  postId: post.id,
                                                }),
                                              }
                                            );
                                          }
                                        }
                                        // Also remove from direct bookmarks if it exists
                                        if (bookmarkedPostIds.has(post.id)) {
                                          await fetch("/api/bookmarks", {
                                            method: "DELETE",
                                            headers: {
                                              "Content-Type":
                                                "application/json",
                                            },
                                            body: JSON.stringify({
                                              userId,
                                              postId: post.id,
                                            }),
                                          });
                                        }
                                        fetchCategories();
                                      }}
                                      onOpenForum={() =>
                                        router.push(`/forum/${post.postId}`)
                                      }
                                      onComment={() => {
                                        console.log(
                                          " Comment button clicked for saved repost:",
                                          {
                                            postId: post.id,
                                            targetId: post.targetId,
                                            postData: post,
                                          }
                                        );
                                        // For reposts, use unique identifier instead of shared targetId
                                        setPreviewPostId(post.postId);
                                        setPreviewPostType("regular");
                                        setPreviewTargetId(
                                          `repost:${post.postId}`
                                        );
                                      }}
                                      headerIcons={
                                        <Box
                                          sx={{
                                            display: "flex",
                                            gap: 1,
                                            justifyContent: "flex-end",
                                          }}
                                        >
                                          <IconButton
                                            size="small"
                                            sx={{
                                              bgcolor: "#fbe9e7",
                                              color: "#d32f2f",
                                              boxShadow: 1,
                                            }}
                                            aria-label="Remove from project"
                                            onClick={async () => {
                                              try {
                                                // For reposts, use the correct targetType
                                                const targetType =
                                                  post.type === "repost"
                                                    ? "repost"
                                                    : "staff_post";
                                                const targetId =
                                                  post.targetId || post.id;
                                                await removePostFromCategory(
                                                  cat.id,
                                                  targetId,
                                                  targetType
                                                );

                                                // Ensure the forum remains bookmarked after removing from project
                                                const isInSavedArea =
                                                  savedForums.some(
                                                    (savedForum: any) =>
                                                      savedForum.targetId ===
                                                      targetId
                                                  );

                                                // If the forum is not in the saved area, explicitly add it to bookmarks
                                                if (!isInSavedArea) {
                                                  console.log(
                                                    " Adding forum to bookmarks after project removal:",
                                                    targetId
                                                  );
                                                  try {
                                                    const response =
                                                      await fetch(
                                                        "/api/mongodb/bookmarks",
                                                        {
                                                          method: "POST",
                                                          headers: {
                                                            "Content-Type":
                                                              "application/json",
                                                          },
                                                          body: JSON.stringify({
                                                            userId:
                                                              session?.userId,
                                                            targetId: targetId,
                                                            targetType:
                                                              post.targetType ||
                                                              "repost",
                                                            completeData: post,
                                                          }),
                                                        }
                                                      );

                                                    const data =
                                                      await response.json();

                                                    if (response.ok) {
                                                      console.log(
                                                        " Forum successfully bookmarked after project removal:",
                                                        data.message
                                                      );
                                                    } else {
                                                      console.log(
                                                        " Failed to bookmark forum after project removal:",
                                                        data.error
                                                      );
                                                    }
                                                  } catch (bookmarkError) {
                                                    console.log(
                                                      " Failed to bookmark forum after project removal (network error):",
                                                      bookmarkError
                                                    );
                                                  }
                                                } else {
                                                  console.log(
                                                    " Forum already bookmarked, no action needed"
                                                  );
                                                }

                                                // Update categories first, then refresh saved content
                                                await fetchCategories();
                                                // Small delay to ensure categories are updated before refreshing saved content
                                                setTimeout(() => {
                                                  refreshSavedContent();
                                                }, 100);
                                              } catch (error) {
                                                console.error(
                                                  "Error removing forum from project:",
                                                  error
                                                );
                                              }
                                            }}
                                          >
                                            <RemoveIcon />
                                          </IconButton>
                                        </Box>
                                      }
                                    />
                                  </Box>
                                );
                              })}
                              {/* Spacer to ensure full visibility of the last forum */}
                              <Box
                                sx={{
                                  width: isMobile ? 20 : 40,
                                  minWidth: isMobile ? 20 : 40,
                                  flexShrink: 0,
                                }}
                              />
                            </Box>
                          </Box>
                        )}
                      </>
                    );
                  })()}
                </React.Fragment>
              ))}
          </Box>
        </Box>
      )}
      {/* Bookmarked Grants Section */}
      <BookmarkedGrantsSection
        savedGrants={savedGrants}
        allCategoryPostIds={allCategoryGrantIds}
        loading={loading}
        onPreview={handleGrantComment}
        onOpenForum={handleGrantForum}
        activeAddCategoryId={activeAddCategoryId}
        toggledCategoryPostIds={toggledCategoryPostIds}
        setToggledCategoryPostIds={setToggledCategoryPostIds}
        addGrantToCategory={async (
          categoryId: number,
          grantId: string,
          grantData?: any
        ) => {
          await fetch("/api/saved-categories/mongodb", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categoryId,
              targetId: grantId,
              targetType: "grant",
              completeData: grantData,
            }),
          });
        }}
        fetchCategories={fetchCategories}
        onUnbookmark={handleUnbookmarkGrant}
        onRemoveFromCategory={handleRemoveGrantFromCategory}
      />
      {/* Bookmarked Posts Section */}
      <BookmarkedPostsSection
        savedPosts={unsortedSavedPosts}
        allCategoryPostIds={allCategoryStaffPostIds}
        loading={loading}
        onPreview={(postId) => handleComment(postId)}
        onOpenForum={handleOpenForum}
        activeAddCategoryId={activeAddCategoryId}
        toggledCategoryPostIds={toggledCategoryPostIds}
        setToggledCategoryPostIds={setToggledCategoryPostIds}
        addStaffPostToCategory={async (
          categoryId,
          postId,
          type,
          completeData
        ) => {
          await addPostToCategory(
            categoryId,
            postId,
            "staffPost",
            completeData
          );
        }}
        fetchCategories={fetchCategories}
        onUnbookmark={handleUnbookmarkPost}
      />
      {/* Bookmarked Eureka Chats Section */}
      {unsortedSavedEurekaResponses.length > 0 && (
        <Box sx={{ width: "100%", mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: "#1976d2",
              mb: 3,
              pl: 4,
            }}
          >
            Eureka Chats
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              pl: 4,
              pr: 4,
            }}
          >
            {unsortedSavedEurekaResponses.map((eurekaResponse: any) => {
              const eurekaId = eurekaResponse.targetId || eurekaResponse.id;
              const showAdd =
                activeAddCategoryId && !toggledCategoryPostIds.has(eurekaId);
              return (
                <SavedEurekaResponseCard
                  key={eurekaResponse.id || eurekaResponse.targetId}
                  eurekaResponse={eurekaResponse}
                  headerIcons={
                    showAdd ? (
                      <IconButton
                        size="small"
                        sx={{
                          bgcolor: "#e3f0fd",
                          color: "#1976d2",
                          boxShadow: 1,
                        }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await addPostToCategory(
                            activeAddCategoryId,
                            eurekaId,
                            "eureka_result" as any,
                            eurekaResponse.completeData || eurekaResponse
                          );
                          setToggledCategoryPostIds((prev) => {
                            const next = new Set(prev);
                            next.add(eurekaId);
                            return next;
                          });
                          fetchCategories();
                        }}
                      >
                        <AddIcon />
                      </IconButton>
                    ) : undefined
                  }
                />
              );
            })}
          </Box>
        </Box>
      )}
      {/* Bookmarked Forums Section */}
      <BookmarkedForumsSection
        savedForums={unsortedSavedForums}
        allCategoryPostIds={allCategoryRepostIds}
        loading={loading}
        onPreview={handleComment}
        onOpenForum={handleOpenForum}
        activeAddCategoryId={activeAddCategoryId}
        toggledCategoryPostIds={toggledCategoryPostIds}
        setToggledCategoryPostIds={setToggledCategoryPostIds}
        addForumToCategory={async (categoryId, postId) => {
          await addPostToCategory(categoryId, postId, "repost");
        }}
        fetchCategories={fetchCategories}
        onUnbookmark={handleUnbookmarkForum}
        onRemoveFromCategory={handleRemoveForumFromCategory}
      />
      <CategoryModal
        open={categoryModalOpen}
        onClose={handleCloseCategoryModal}
        onCreate={handleCreateCategory}
        loading={categoriesLoading}
        error={categoryError}
        value={newCategoryName}
        onChange={setNewCategoryName}
      />
      {/* Right-hand side forum preview modal - copied from home feed */}
      {((previewPostId && previewPostType === "regular") ||
        (typeof previewStaffPostId === "number" &&
          previewPostType === "staff")) && (
        <>
          {/* Backdrop */}
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              bgcolor: isMobile ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.09)",
              zIndex: 2999,
              ...(isMobile && {
                backdropFilter: "blur(2px)",
              }),
            }}
            onClick={() => {
              setPreviewPostId(null);
              setPreviewStaffPostId(null);
              setPreviewPostType(null);
              setPreviewTargetId(null);
            }}
          />
          {/* Forum Panel */}
          <Box
            sx={{
              position: "fixed",
              top: isMobile ? 0 : 72,
              right: isMobile ? 0 : 32,
              bottom: isMobile ? 0 : 32,
              left: isMobile ? 0 : "auto",
              width: isMobile ? "100vw" : 420,
              bgcolor: "white",
              color: "black",
              borderRadius: isMobile ? 0 : 4,
              boxShadow: isMobile ? "none" : "0 8px 32px rgba(0,0,0,0.18)",
              zIndex: 3000,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              height: isMobile ? "100vh" : "calc(100vh - 72px - 32px)",
              maxHeight: "100vh",
            }}
          >
            {/* Header with close button */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: isMobile ? "space-between" : "flex-end",
                p: isMobile ? 3 : 0,
                borderBottom: isMobile ? "1px solid #e0e0e0" : "none",
                bgcolor: isMobile ? "#f8f9fa" : "transparent",
              }}
            >
              {isMobile && (
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    color: "#333",
                    fontSize: 18,
                  }}
                >
                  Comments
                </Typography>
              )}
              <IconButton
                onClick={() => {
                  setPreviewPostId(null);
                  setPreviewStaffPostId(null);
                  setPreviewPostType(null);
                  setPreviewTargetId(null);
                }}
                sx={{
                  color: "#888",
                  ...(isMobile && {
                    bgcolor: "#fff",
                    border: "1px solid #e0e0e0",
                    "&:hover": {
                      bgcolor: "#f5f5f5",
                    },
                  }),
                }}
                aria-label="Close"
              >
                <CloseIcon />
              </IconButton>
            </Box>
            {/* ForumPage content for the selected post, inlined here */}
            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                maxHeight: "100%",
                ...(isMobile && {
                  px: 2,
                  pt: 1,
                }),
              }}
            >
              <CommentPopup
                postId={
                  typeof previewPostId === "string"
                    ? parseInt(previewPostId)
                    : previewPostId
                }
                staffPostId={previewStaffPostId}
                targetId={previewTargetId}
              />
            </Box>
          </Box>
        </>
      )}
      <DeleteCategoryDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onDelete={async () => {
          if (!categoryToDelete) return;
          await deleteCategory(categoryToDelete.id);
          setDeleteDialogOpen(false);
          setCategoryToDelete(null);
        }}
        loading={categoriesLoading}
        categoryName={categoryToDelete?.name || ""}
      />

      {/* Unbookmark Confirmation Dialog */}
      <Dialog
        open={unbookmarkDialogOpen}
        onClose={cancelUnbookmark}
        aria-labelledby="unbookmark-dialog-title"
        aria-describedby="unbookmark-dialog-description"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="unbookmark-dialog-title">
          Remove from Saved?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="unbookmark-dialog-description">
            Are you sure you want to remove this {itemToUnbookmark?.type} from
            your saved items?
          </DialogContentText>
          {itemToUnbookmark && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                bgcolor: "#f5f5f5",
                borderRadius: 1,
                border: "1px solid #e0e0e0",
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: "#333",
                  lineHeight: 1.4,
                }}
              >
                &ldquo;{itemToUnbookmark.title}&rdquo;
              </Typography>
            </Box>
          )}
          <DialogContentText
            sx={{ mt: 2, fontSize: "0.875rem", color: "#666" }}
          >
            This action cannot be undone. Your notes for this{" "}
            {itemToUnbookmark?.type} will also be deleted. You can bookmark this{" "}
            {itemToUnbookmark?.type} again later if needed.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={cancelUnbookmark}
            variant="outlined"
            sx={{
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmUnbookmark}
            variant="contained"
            color="error"
            sx={{
              textTransform: "none",
              fontWeight: 500,
              bgcolor: "#d32f2f",
              "&:hover": {
                bgcolor: "#b71c1c",
              },
            }}
          >
            Remove from Saved
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SavedContent;

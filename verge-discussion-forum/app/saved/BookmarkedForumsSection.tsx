import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FeedCard from "../forum/FeedCard";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import { useRouter } from "next/navigation";

interface BookmarkedForumsSectionProps {
  savedForums: any[];
  allCategoryPostIds: (number | string)[];
  onPreview: (postId: number | string) => void;
  onOpenForum: (postId: number | string) => void;
  loading: boolean;
  activeAddCategoryId: number | null;
  toggledCategoryPostIds: Set<number | string>;
  setToggledCategoryPostIds: React.Dispatch<
    React.SetStateAction<Set<number | string>>
  >;
  addForumToCategory: (
    categoryId: number,
    postId: number | string
  ) => Promise<void>;
  fetchCategories: () => void;
  onUnbookmark?: (postId: number | string) => void;
  onRemoveFromCategory?: (postId: number | string) => void;
}

const BookmarkedForumsSection: React.FC<BookmarkedForumsSectionProps> = ({
  savedForums,
  allCategoryPostIds,
  onPreview,
  onOpenForum,
  loading,
  activeAddCategoryId,
  toggledCategoryPostIds,
  setToggledCategoryPostIds,
  addForumToCategory,
  fetchCategories,
  onUnbookmark,
  onRemoveFromCategory,
}) => {
  // Debug: Log what data we receive
  console.log(
    " BookmarkedForumsSection received savedForums:",
    savedForums.length
  );
  console.log(
    " BookmarkedForumsSection data:",
    savedForums.map((p) => ({
      targetId: p.targetId,
      postId: p.postId,
      content: p.content?.substring(0, 30) + "...",
      type: p.type,
    }))
  );
  const router = useRouter();
  // Filter out reposts that are already in ANY project/category
  const unsortedSavedForums = savedForums.filter((post) => {
    // Use the same ID logic as when adding to category
    const correctId = post.postId || post.targetId || post.id;

    // Check if this repost is in the active add category (when + toggle is on)
    const isInActiveCategory =
      activeAddCategoryId && toggledCategoryPostIds.has(correctId);

    // Check if this repost is in ANY category/project
    const isInAnyCategory = allCategoryPostIds.includes(correctId);

    console.log(" BookmarkedForumsSection filtering:", {
      postId: post.targetId,
      postIdUUID: post.postId,
      correctId: correctId,
      isInActiveCategory,
      isInAnyCategory,
      shouldShow: !isInAnyCategory,
    });

    // Hide the repost if it's in ANY category/project
    return !isInAnyCategory;
  });

  // Debug: Log the final filtered data
  console.log(
    " BookmarkedForumsSection final filtered count:",
    unsortedSavedForums.length
  );
  console.log(
    " BookmarkedForumsSection final data:",
    unsortedSavedForums.map((p) => ({
      targetId: p.targetId,
      postId: p.postId,
      content: p.content?.substring(0, 30) + "...",
      type: p.type,
    }))
  );
  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(max-width:600px)").matches;
  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography>Loading forums...</Typography>
      </Box>
    );
  }
  if (unsortedSavedForums.length === 0) return null;

  return (
    <Box sx={{ mt: 4, width: "100%", minWidth: 0 }}>
      <Typography
        variant="h6"
        sx={{ fontWeight: 700, mb: 2, color: "#1976d2", pl: 4 }}
      >
        Bookmarked Forums
      </Typography>
      <Box
        sx={{
          width: "100%",
          minWidth: 0,
          display: "flex",
          flexDirection: "row",
          gap: isMobile ? 2 : 52,
          overflowX: "auto",
          overflowY: "visible",
          pb: 2,
          pl: 4,
          pr: 8, // Increased right padding to ensure full visibility
          scrollbarWidth: "auto",
          "&::-webkit-scrollbar": {
            height: 12,
            backgroundColor: "#f1f1f1",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#c1c1c1",
            borderRadius: 4,
            "&:hover": {
              backgroundColor: "#a8a8a8",
            },
          },
        }}
      >
        {unsortedSavedForums.map((repost) => {
          const correctId = repost.targetId || repost.postId || repost.id;
          const showAdd =
            activeAddCategoryId && !toggledCategoryPostIds.has(correctId);
          return (
            <Box
              key={repost.id}
              sx={{
                width: isMobile ? "100vw" : 600,
                minWidth: isMobile ? "100vw" : 600,
                maxWidth: isMobile ? "100vw" : 600,
                flexShrink: 0,
                position: "relative",
              }}
            >
              <FeedCard
                post={repost.post || { ...repost, type: "repost" }}
                userId={repost.userId}
                bookmarked={true}
                onUnbookmark={
                  onUnbookmark ? () => onUnbookmark(repost.id) : undefined
                }
                onOpenForum={() => {
                  console.log(
                    " BookmarkedForumsSection - Open Forum clicked:",
                    {
                      repostId: repost.id,
                      postId: repost.postId,
                      targetId: repost.targetId,
                      type: repost.type,
                    }
                  );
                  // For reposts, we need to pass the saved item's ID to handleOpenForum
                  // so it can look up the saved item data
                  onOpenForum(repost.id);
                }}
                onComment={() => {
                  console.log(" Comment button clicked for saved repost:", {
                    repostId: repost.id,
                    targetId: repost.targetId,
                    postId: repost.postId,
                    repostData: repost,
                  });
                  onPreview(repost.id);
                }}
                headerIcons={
                  showAdd ? (
                    <IconButton
                      size="small"
                      sx={{
                        bgcolor: "#e3f0fd",
                        color: "#1976d2",
                        boxShadow: 1,
                      }}
                      onClick={async () => {
                        // For reposts, use the postId (UUID) instead of targetId (OpenAlex URL)
                        const correctId =
                          repost.postId || repost.targetId || repost.id;
                        console.log(" Adding repost to category:", {
                          repostId: repost.id,
                          postId: repost.postId,
                          targetId: repost.targetId,
                          correctId: correctId,
                          type: repost.type,
                        });
                        await addForumToCategory(
                          activeAddCategoryId,
                          correctId
                        );
                        setToggledCategoryPostIds((prev) => {
                          const next = new Set(prev);
                          next.add(correctId);
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
            </Box>
          );
        })}
        {/* Spacer to ensure full visibility of the last post */}
        <Box
          sx={{
            width: isMobile ? 20 : 40,
            minWidth: isMobile ? 20 : 40,
            flexShrink: 0,
          }}
        />
      </Box>
    </Box>
  );
};

export default BookmarkedForumsSection;

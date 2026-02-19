import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import StaffPostCard from "../../home_feed_page/StaffPostCard";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import { useRouter } from "next/navigation";

interface BookmarkedPostsSectionProps {
  savedPosts: any[];
  allCategoryPostIds: number[];
  onPreview: (postId: number) => void;
  onOpenForum: (postId: number) => void;
  loading: boolean;
  activeAddCategoryId: number | null;
  toggledCategoryPostIds: Set<number | string>;
  setToggledCategoryPostIds: React.Dispatch<
    React.SetStateAction<Set<number | string>>
  >;
  addStaffPostToCategory: (
    categoryId: number | string,
    postId: number | string,
    type?: "post" | "staffPost",
    completeData?: any
  ) => Promise<void>;
  fetchCategories: () => void;
  onUnbookmark?: (postId: number | string) => void;
}

const BookmarkedPostsSection: React.FC<BookmarkedPostsSectionProps> = ({
  savedPosts,
  allCategoryPostIds,
  onPreview,
  onOpenForum,
  loading,
  activeAddCategoryId,
  toggledCategoryPostIds,
  setToggledCategoryPostIds,
  addStaffPostToCategory,
  fetchCategories,
  onUnbookmark,
}) => {
  const router = useRouter();
  // Show all posts not in any category
  const unsortedSavedPosts = savedPosts.filter(
    (post) => !allCategoryPostIds.includes(post.id)
  );
  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(max-width:600px)").matches;
  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography>Loading posts...</Typography>
      </Box>
    );
  }
  if (unsortedSavedPosts.length === 0) return null;
  return (
    <Box sx={{ mt: 4, width: "100%", minWidth: 0 }}>
      <Typography
        variant="h6"
        sx={{ fontWeight: 700, mb: 2, color: "#1976d2", pl: 4 }}
      >
        Bookmarked Staff Posts
      </Typography>
      <Box
        sx={{
          width: "100%",
          minWidth: 0,
          display: "flex",
          flexDirection: "row",
          gap: isMobile ? 2 : 45,
          overflowX: "auto",
          overflowY: "visible",
          pb: 2,
          pl: 4,
          pr: 12, // Increased right padding to ensure full visibility
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
        {unsortedSavedPosts.map((post) => {
          const showAdd =
            activeAddCategoryId && !toggledCategoryPostIds.has(post.id);
          return (
            <Box
              key={post.id}
              sx={{
                width: isMobile ? 320 : 600,
                minWidth: isMobile ? 320 : 600,
                maxWidth: isMobile ? 320 : 600,
                flexShrink: 0,
                position: "relative",
              }}
            >
              <StaffPostCard
                post={post}
                hideRepostButton={false} // FIXED: Show repost button like in home feed
                showBookmark={true}
                bookmarked={true}
                onOpenForum={() => onOpenForum(post.id)}
                onComment={() => onPreview(post.id)}
                onUnbookmark={
                  onUnbookmark ? () => onUnbookmark(post.id) : undefined
                }
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
                        await addStaffPostToCategory(
                          activeAddCategoryId,
                          post.targetId || post.id,
                          "staffPost",
                          post
                        );
                        setToggledCategoryPostIds((prev) => {
                          const next = new Set(prev);
                          next.add(post.id);
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

export default BookmarkedPostsSection;

import React, { useRef, useEffect, useCallback } from "react";
import { FixedSizeList as List } from "react-window";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { StaffPost } from "../app/forum_feed_page/staffPostApi";
import StaffPostCard from "./StaffPostCard";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

interface VirtualizedFeedProps {
  posts: StaffPost[];
  loading: boolean;
  error: string | null;
  targetPostIndex: number | null;
  onLoadMore?: () => void;
  onOpenForum: (postId: number) => void;
  onComment: (postId: number) => void;
  height: number;
  itemHeight: number;
}

const VirtualizedFeed: React.FC<VirtualizedFeedProps> = ({
  posts,
  loading,
  error,
  targetPostIndex,
  onLoadMore,
  onOpenForum,
  onComment,
  height,
  itemHeight,
}) => {
  const listRef = useRef<List>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });

  // Scroll to target post when it's loaded
  useEffect(() => {
    if (targetPostIndex !== null && listRef.current) {
      listRef.current.scrollToItem(targetPostIndex, "center");
    }
  }, [targetPostIndex]);

  // Handle scroll to detect when we need to load more
  const handleScroll = useCallback(
    ({ scrollOffset, scrollUpdateWasRequested }: any) => {
      if (scrollUpdateWasRequested) return;

      const threshold = height * 0.8; // Load more when 80% scrolled
      if (onLoadMore && scrollOffset > threshold) {
        onLoadMore();
      }
    },
    [height, onLoadMore]
  );

  // Render individual post item
  const renderPost = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const post = posts[index];

      if (!post) {
        return (
          <Box
            style={style}
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CircularProgress size={24} />
          </Box>
        );
      }

      return (
        <Box
          style={style}
          sx={{
            display: "flex",
            justifyContent: "center",
            mb: 3, // 24px gap between posts (theme.spacing(3) = 24px)
          }}
        >
          <StaffPostCard
            post={post}
            onOpenForum={() => onOpenForum(post.id)}
            onComment={() => onComment(post.id)}
          />
        </Box>
      );
    },
    [posts, onOpenForum, onComment, isMobile]
  );

  if (error) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height,
        }}
      >
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (loading && posts.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height, width: "100%" }}>
      <List
        ref={listRef}
        height={height}
        width="100%"
        itemCount={posts.length}
        itemSize={itemHeight}
        onScroll={handleScroll}
        overscanCount={5} // Render 5 items outside viewport for smooth scrolling
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {renderPost}
      </List>

      {/* Loading indicator at bottom */}
      {loading && posts.length > 0 && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
};

export default VirtualizedFeed;

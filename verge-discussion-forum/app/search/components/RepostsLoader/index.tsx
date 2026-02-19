import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { Box, Typography, CircularProgress, Alert } from "@mui/material";
import { useRepostsSearch } from "../../hooks/useRepostsSearch";
import { useBatchDataLoading } from "../../useBatchDataLoading";
import FeedCard from "../../../forum/FeedCard";

interface RepostsLoaderProps {
  selectedSubfields: { id: string; name: string }[];
  isMobile: boolean;
  userId?: string;
  applyKey?: number;
  yearRange?: [number, number];
  minCitations?: number;
}

export const RepostsLoader: React.FC<RepostsLoaderProps> = ({
  selectedSubfields,
  isMobile,
  userId,
  applyKey,
  yearRange,
  minCitations,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  // Get selected subfield names
  const selectedSubfieldNames = useMemo(
    () => selectedSubfields.map((s) => s.name),
    [selectedSubfields]
  );

  console.log(" RepostsLoader render:", {
    selectedSubfields: selectedSubfields.length,
    selectedSubfieldNames,
    isMobile,
    userId,
  });

  // Use the reposts search hook - only pass subfields if they exist
  const { reposts, loading, error, hasMore, loadMore, loadReposts } =
    useRepostsSearch({
      pageSize: 20,
      selectedSubfields:
        selectedSubfieldNames.length > 0 ? selectedSubfieldNames : [],
    });

  console.log(" RepostsLoader state:", {
    repostsCount: reposts.length,
    loading,
    error,
    hasMore,
  });

  // Trigger search when subfields change
  useEffect(() => {
    console.log(" RepostsLoader useEffect triggered:", {
      selectedSubfieldNames,
      length: selectedSubfieldNames.length,
    });
    if (selectedSubfieldNames.length > 0) {
      // Trigger a fresh search when subfields are selected
      console.log(
        " Triggering loadReposts for subfields:",
        selectedSubfieldNames
      );
      loadReposts(1, false);
    }
  }, [selectedSubfieldNames.join(","), loadReposts]);

  // Batch data loading for likes and bookmarks
  const {
    data: batchData,
    loading: batchDataLoading,
    error: batchDataError,
  } = useBatchDataLoading({
    staffPostIds: reposts.map((repost: any) => repost.staffPost.id),
    repostIds: reposts.map((repost: any) => repost.id),
  });

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, loadMore]);

  // Loading state
  const isLoading = loading || batchDataLoading;

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Failed to load reposts: {error}</Alert>
      </Box>
    );
  }

  // No subfields selected state
  if (selectedSubfieldNames.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography
          variant="h6"
          color="text.secondary"
          align="center"
          sx={{ mb: 2 }}
        >
          Select subfields to search forums
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center">
          Choose one or more subfields from the dropdown above to find relevant
          discussion forums
        </Typography>
      </Box>
    );
  }

  // No reposts found state
  if (!isLoading && reposts.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="body1" color="text.secondary" align="center">
          No discussion forums found for the selected subfields:{" "}
          {selectedSubfieldNames.join(", ")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Reposts Header */}
      <Typography
        variant="h6"
        sx={{ fontWeight: 700, mb: 2, color: "#1976d2", pl: 2, flexShrink: 0 }}
      >
        Discussion Forums
        {selectedSubfieldNames.length > 0 && (
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ ml: 1 }}
          >
            ({reposts.length} found)
          </Typography>
        )}
      </Typography>

      {/* Reposts Container - Vertical Scroll */}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          px: isMobile ? 2 : 3,
          pb: 2,
          scrollbarWidth: "thin",
          "&::-webkit-scrollbar": {
            width: 8,
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: "#f1f1f1",
            borderRadius: 4,
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
        {/* Reposts - Vertical Layout */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {reposts.map((repost: any) => (
            <Box
              key={repost.id}
              sx={{
                width: "100%",
                maxWidth: "100%",
              }}
            >
              <FeedCard
                post={repost}
                userId={userId || "test-user-1"}
                onComment={() => {
                  window.open(`/forum/${repost.postId}`, "_blank");
                }}
                onOpenForum={() => {
                  window.open(`/forum/${repost.postId}`, "_blank");
                }}
              />
            </Box>
          ))}

          {/* Initial Loading State */}
          {isLoading && reposts.length === 0 && (
            <Box
              sx={{
                p: 4,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
              }}
            >
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>
                Searching for forums with subfields:{" "}
                {selectedSubfieldNames.join(", ")}...
              </Typography>
            </Box>
          )}

          {/* Load More Indicator */}
          {hasMore && (
            <Box
              ref={loadingRef}
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                py: 2,
                width: "100%",
              }}
            >
              {loading && <CircularProgress size={24} />}
            </Box>
          )}
        </Box>
      </Box>

      {/* Batch Data Loading Status */}
      {batchDataLoading && (
        <Box sx={{ p: 2, textAlign: "center", flexShrink: 0 }}>
          <Typography variant="body2" color="text.secondary">
            Loading interaction data...
          </Typography>
        </Box>
      )}
    </Box>
  );
};

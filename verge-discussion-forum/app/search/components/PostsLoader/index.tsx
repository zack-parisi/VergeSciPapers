import React, { useRef, useEffect, useCallback } from "react";
import { Box, Typography, CircularProgress, Alert } from "@mui/material";
import StaffPostCard from "../../../../home_feed_page/StaffPostCard";
import { useMongoDBPapers } from "../../../hooks/useMongoDBPapers";
import { useBatchDataLoading } from "../../useBatchDataLoading";
import { useSearchPosts } from "../../hooks/useSearchPosts";

interface PostsLoaderProps {
  yearRange?: [number, number];
  minCitations?: number;
  applyKey?: number;
  selectedSubfields: { id: string; name: string }[];
  selectedJournals?: { id: string; name: string }[];
  searchType?: "topics" | "authors" | "title" | "journals";
  searchValue?: string;
  isMobile: boolean;
  userId?: string;
  onComment?: (postId: number | string) => void;
  onOpenForum?: (postId: number | string) => void;
}

export const PostsLoader: React.FC<PostsLoaderProps> = ({
  yearRange,
  minCitations,
  applyKey,
  selectedSubfields,
  selectedJournals = [],
  searchType = "topics",
  searchValue = "",
  isMobile,
  userId,
  onComment,
  onOpenForum,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  // Get selected subfield and journal names
  const selectedSubfieldNames = selectedSubfields.map((s) => s.name);
  const selectedJournalNames = selectedJournals.map((j) => j.name);

  console.log(" PostsLoader render:", {
    selectedSubfields: selectedSubfields.length,
    selectedSubfieldNames,
    selectedJournals: selectedJournals.length,
    selectedJournalNames,
    isMobile,
    userId,
  });

  // Use different hooks based on search type
  const mongoDBPapersHook = useMongoDBPapers({
    limit: 30,
    algorithm: "relevance",
    autoFetch: false, // Don't auto-fetch initially
  });

  const searchPostsHook = useSearchPosts({
    limit: 30,
    autoFetch: false,
  });

  // Choose which hook to use based on search type
  const isTopicsSearch = searchType === "topics";
  const isJournalsSearch = searchType === "journals";
  const {
    papers: mongoPosts,
    loading: mongoLoading,
    error: mongoError,
    pagination,
    fetchPapers,
    setSubfields,
    setJournals,
  } = mongoDBPapersHook;

  const {
    posts: searchPosts,
    loading: searchLoading,
    error: searchError,
    fetchPosts: fetchSearchPosts,
  } = searchPostsHook;

  // Use the appropriate data based on search type
  const posts = isTopicsSearch || isJournalsSearch ? mongoPosts : searchPosts;
  const loading =
    isTopicsSearch || isJournalsSearch ? mongoLoading : searchLoading;
  const error = isTopicsSearch || isJournalsSearch ? mongoError : searchError;

  console.log(" PostsLoader state:", {
    postsCount: posts.length,
    loading,
    error,
    pagination,
  });

  // Update search based on search type and parameters
  useEffect(() => {
    console.log(" PostsLoader useEffect triggered:", {
      searchType,
      searchValue,
      selectedSubfieldNames,
      selectedJournalNames,
      length: selectedSubfieldNames.length,
      journalsLength: selectedJournalNames.length,
    });

    if (isTopicsSearch) {
      // For topics search, use the MongoDB papers hook
      setSubfields(selectedSubfieldNames);
    } else if (isJournalsSearch) {
      // For journals search, use the MongoDB papers hook with journal filtering
      setJournals(selectedJournalNames);
    } else if (searchValue.trim()) {
      // For author/title search, use the search posts hook
      fetchSearchPosts(searchType, searchValue, selectedSubfieldNames);
    }
  }, [
    searchType,
    searchValue,
    selectedSubfieldNames.join(","),
    selectedJournalNames.join(","),
    isTopicsSearch,
    isJournalsSearch,
    setSubfields,
    setJournals,
    fetchSearchPosts,
  ]);

  // Apply filters when applyKey changes
  useEffect(() => {
    if (applyKey && applyKey > 0) {
      console.log(" Apply key changed, triggering filter fetch:", applyKey, {
        searchType,
        yearRangeStart: yearRange?.[0],
        yearRangeEnd: yearRange?.[1],
        minCitations: minCitations,
      });

      if (isTopicsSearch || isJournalsSearch) {
        fetchPapers({
          page: 1,
          yearRangeStart: yearRange?.[0],
          yearRangeEnd: yearRange?.[1],
          minCitations: minCitations,
        });
      } else if (searchValue.trim()) {
        // For search posts, we need to re-fetch with the same search parameters
        fetchSearchPosts(searchType, searchValue, selectedSubfieldNames);
      }
    }
  }, [
    applyKey,
    yearRange,
    minCitations,
    fetchPapers,
    searchType,
    searchValue,
    selectedSubfieldNames,
    isTopicsSearch,
    isJournalsSearch,
    fetchSearchPosts,
  ]);
  // Batch data loading for likes and bookmarks
  const {
    data: batchData,
    loading: batchDataLoading,
    error: batchDataError,
  } = useBatchDataLoading({
    staffPostIds: posts.map((post) => parseInt(String(post.id), 10)),
    repostIds: [], // We'll handle reposts separately
  });

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!pagination?.hasNext || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchPapers();
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
  }, [pagination?.hasNext, loading, fetchPapers]);

  // Loading state
  const isLoading = loading || batchDataLoading;

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Failed to load posts: {error}</Alert>
      </Box>
    );
  }

  // No subfields selected state - only show this for topics search
  if (isTopicsSearch && selectedSubfieldNames.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography
          variant="h6"
          color="text.secondary"
          align="center"
          sx={{ mb: 2 }}
        >
          Select subfields to search papers
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center">
          Choose one or more subfields from the dropdown above to find relevant
          papers
        </Typography>
      </Box>
    );
  }

  // No journals selected state - only show this for journals search
  if (isJournalsSearch && selectedJournalNames.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography
          variant="h6"
          color="text.secondary"
          align="center"
          sx={{ mb: 2 }}
        >
          Select journals to search papers
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center">
          Choose one or more journals from the dropdown above to find relevant
          papers
        </Typography>
      </Box>
    );
  }

  // No search query state - for author/title searches (not for journals)
  if (!isTopicsSearch && !isJournalsSearch && !searchValue.trim()) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography
          variant="h6"
          color="text.secondary"
          align="center"
          sx={{ mb: 2 }}
        >
          Enter {searchType === "authors" ? "author name" : "title keywords"} to
          search
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center">
          Type{" "}
          {searchType === "authors"
            ? "an author's name"
            : "keywords from the paper title"}{" "}
          in the search box above
        </Typography>
      </Box>
    );
  }

  // No posts found state
  if (!isLoading && posts.length === 0) {
    let message = "";
    if (isTopicsSearch) {
      message = `No papers found for the selected subfields: ${selectedSubfieldNames.join(", ")}`;
    } else if (searchType === "authors") {
      message = `No papers found for author: "${searchValue}"`;
    } else if (searchType === "title") {
      message = `No papers found with title containing: "${searchValue}"`;
    }

    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="body1" color="text.secondary" align="center">
          {message}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          sx={{ mt: 1, display: "block" }}
        >
          Try adjusting your search terms or filters
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
      <Typography
        variant="h6"
        sx={{ fontWeight: 700, mb: 2, color: "#1976d2", pl: 2, flexShrink: 0 }}
      >
        Research Papers
      </Typography>

      {/* Posts Container - Vertical Scroll */}
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
        {/* Posts - Vertical Layout */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {posts.map((post) => (
            <Box
              key={post.id}
              sx={{
                width: "100%",
                maxWidth: "100%",
              }}
            >
              <StaffPostCard
                post={post as any}
                compact={true}
                showBookmark={true}
                hideRepostButton={false}
                hideActions={false}
                bookmarked={
                  batchData?.bookmarks?.[parseInt(post.id, 10)] || false
                }
                liked={
                  batchData?.likes?.[parseInt(post.id, 10)]?.liked || false
                }
                likeCount={
                  batchData?.likes?.[parseInt(post.id, 10)]?.count || 0
                }
                onComment={() => {
                  console.log(" Comment button clicked in search:", {
                    postId: post.id,
                    postData: post,
                  });
                  onComment?.(post.id);
                }}
                onOpenForum={() => {
                  console.log(" Open forum button clicked in search:", {
                    postId: post.id,
                    postData: post,
                  });
                  onOpenForum?.(post.id);
                }}
              />
            </Box>
          ))}

          {/* Initial Loading State */}
          {isLoading && posts.length === 0 && (
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
                {isTopicsSearch &&
                  `Searching for papers with subfields: ${selectedSubfieldNames.join(", ")}...`}
                {isJournalsSearch &&
                  `Searching for papers from journals: ${selectedJournalNames.join(", ")}...`}
                {!isTopicsSearch &&
                  !isJournalsSearch &&
                  "Searching for papers..."}
              </Typography>
            </Box>
          )}

          {/* Load More Indicator */}
          {pagination?.hasNext && (
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

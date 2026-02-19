"use client";
import React, { useEffect, useState, Suspense } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import StaffPostCard from "./StaffPostCard";
import {
  createStaffPost,
  StaffPost,
} from "../app/forum_feed_page/staffPostApi";
import ForumLayout from "../app/forum_layout/ForumLayout";
import { useSession } from "next-auth/react";
import CreateStaffPostModal from "./CreateStaffPostModal";
import ForumPage from "../app/forum/page";
import CommentPopup from "../app/forum/CommentPopup";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { useRouter, useSearchParams } from "next/navigation";
import { useMongoDBPapers } from "../app/hooks/useMongoDBPapers";
import { useInterestsFeed } from "./useInterestsFeed";
import { Virtuoso } from "react-virtuoso";
import { useInfiniteScroll } from "../app/hooks/useInfiniteScroll";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { activityTracker } from "../utils/activityTracker";
import Link from "next/link";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

function HomeFeedPageContent() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const { data: session, status } = useSession();
  const userId = session?.userId || "test-user-1";
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });

  // Helper to require authentication for actions
  const requireAuth = (action: () => void) => {
    console.log(
      "requireAuth called with status:",
      status,
      "userId:",
      session?.userId
    );
    if (status !== "authenticated") {
      console.log("User not authenticated, redirecting to login");
      router.push("/login");
      return;
    }
    console.log("User authenticated, executing action");
    action();
  };

  // Remove tab state and saved feed state

  // Get target post ID from URL parameter
  const targetPostId = searchParams.get("postId");

  // Highlighted post state
  const [highlightedPost, setHighlightedPost] = useState<StaffPost | null>(
    null
  );

  // Staff post modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [previewPostId, setPreviewPostId] = useState<number | null>(null);
  const [previewPostType, setPreviewPostType] = useState<
    "staff" | "regular" | null
  >(null);
  const [previewTargetId, setPreviewTargetId] = useState<string | null>(null);

  // Tab and algorithm state
  const [activeTab, setActiveTab] = useState("explore");
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("relevance");
  const [selectedInterestsAlgorithm, setSelectedInterestsAlgorithm] =
    useState("relevance");
  const [algorithmChanging, setAlgorithmChanging] = useState(false);
  const [algorithmAnchorEl, setAlgorithmAnchorEl] =
    useState<null | HTMLElement>(null);

  // Define tabs
  const tabs = [
    { label: "Explore", value: "explore" },
    { label: "Research Interests", value: "interests" },
  ];

  // Algorithm dropdown handlers
  const handleAlgorithmMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAlgorithmAnchorEl(event.currentTarget);
  };

  const handleAlgorithmMenuClose = () => {
    setAlgorithmAnchorEl(null);
  };

  // Use MongoDB papers hook for explore tab with infinite scroll
  const {
    papers: explorePosts,
    loading: exploreLoading,
    loadingMore: exploreLoadingMore,
    error: exploreError,
    fetchPapers: exploreRefresh,
    loadMore: exploreLoadMore,
    setAlgorithm: setExploreAlgorithm,
    hasMore: exploreHasMore,
    setEnableTiered: setExploreTiered,
  } = useMongoDBPapers({
    limit: 50,
    algorithm: selectedAlgorithm as "seminal" | "relevance",
    autoFetch: true,
    enableTiered: true, // Enable tiered queries for universal coverage
    enableInfiniteScroll: true, // Enable infinite scroll
  });

  // Use interests feed hook for research interests tab
  const {
    posts: interestsPosts,
    loading: interestsLoading,
    error: interestsError,
    refresh: interestsRefresh,
  } = useInterestsFeed(50, selectedInterestsAlgorithm);

  // Determine which posts to show based on active tab
  const posts = activeTab === "explore" ? explorePosts : interestsPosts;
  const loading = activeTab === "explore" ? exploreLoading : interestsLoading;
  const loadingMore = activeTab === "explore" ? exploreLoadingMore : false;
  const error = activeTab === "explore" ? exploreError : interestsError;
  const refresh = activeTab === "explore" ? exploreRefresh : interestsRefresh;
  const hasMore = activeTab === "explore" ? exploreHasMore : false;
  const loadMore =
    activeTab === "explore" ? exploreLoadMore : () => Promise.resolve();

  // Debug logging for infinite scroll state
  console.log(" Infinite scroll state:", {
    hasMore,
    loadingMore,
    postsCount: posts.length,
    activeTab,
    firstPostId: posts[0]?.id,
    lastPostId: posts[posts.length - 1]?.id,
    highlightedPost: highlightedPost
      ? {
          id: highlightedPost.id,
          title: highlightedPost.title?.substring(0, 50),
          hasHighlightedPost: true,
        }
      : null,
  });

  // Infinite scroll hook for explore tab - now triggers when Footer becomes visible
  const infiniteScrollRef = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore: hasMore,
    loading: loadingMore,
    threshold: 100, // Smaller threshold since we're triggering from Footer
  });

  // Backup scroll-based infinite scroll for explore tab
  useEffect(() => {
    if (activeTab !== "explore" || !hasMore || loadingMore) return;

    const handleScroll = () => {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Trigger when user is within 200px of the bottom
      if (scrollTop + windowHeight >= documentHeight - 200) {
        console.log(" Scroll-based infinite scroll triggered");
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeTab, hasMore, loadingMore, loadMore]);

  // Fetch and pin the highlighted post if postId is present
  useEffect(() => {
    const fetchHighlighted = async () => {
      if (targetPostId) {
        console.log(
          " Fetching highlighted post with targetPostId:",
          targetPostId
        );

        // Check if this is an OpenAlex URL (MongoDB paper) or numeric ID (staff post)
        const isOpenAlexUrl =
          targetPostId.includes("openalex:") ||
          targetPostId.includes("openalex.org");

        if (isOpenAlexUrl) {
          // This is a MongoDB paper - fetch from MongoDB papers API
          console.log(" Detected OpenAlex URL, fetching MongoDB paper");
          try {
            const res = await fetch(
              `/api/papers/mongodb/single?targetId=${encodeURIComponent(targetPostId)}`
            );
            const data = await res.json();
            const paper = data.papers?.[0] || null;
            if (paper) {
              console.log(
                " Found MongoDB paper for highlighting:",
                paper.title
              );
              setHighlightedPost(paper);
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              console.log(" No MongoDB paper found for:", targetPostId);
              setHighlightedPost(null);
            }
          } catch (error) {
            console.error(" Error fetching MongoDB paper:", error);
            setHighlightedPost(null);
          }
        } else {
          // This is a staff post - fetch from staff posts API
          console.log(" Detected numeric ID, fetching staff post");
          try {
            const numericId = parseInt(targetPostId);
            if (isNaN(numericId)) {
              console.log(" Invalid numeric ID:", targetPostId);
              setHighlightedPost(null);
              return;
            }

            const res = await fetch(
              `/api/staff-posts?postId=${numericId}&contextSize=0`
            );
            const data = await res.json();
            const post = data.posts?.[0] || null;
            setHighlightedPost(post);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch (error) {
            console.error(" Error fetching staff post:", error);
            setHighlightedPost(null);
          }
        }
      } else {
        setHighlightedPost(null);
      }
    };
    fetchHighlighted();
  }, [targetPostId]);

  // Refresh appropriate feed when algorithm or tab changes
  useEffect(() => {
    if (activeTab === "explore") {
      exploreRefresh();
    } else {
      interestsRefresh();
    }
  }, [
    selectedAlgorithm,
    selectedInterestsAlgorithm,
    activeTab,
    exploreRefresh,
    interestsRefresh,
  ]);

  // Remove saved feed fetching effect

  const handleCreateStaffPost = async (data: any) => {
    requireAuth(async () => {
      const apiData = {
        ...data,
        publicationDate: data.publicationDate
          ? data.publicationDate.toISOString()
          : new Date().toISOString(),
      };
      setPosting(true);
      setPostError(null);
      try {
        await createStaffPost(userId, apiData);
        // Refresh both feeds
        await exploreRefresh();
        await interestsRefresh();
        setModalOpen(false);
      } catch (e: any) {
        setPostError(e.message || "Failed to create staff post");
      } finally {
        setPosting(false);
      }
    });
  };

  const handleOpenForum = (postId: number | string) => {
    requireAuth(() => {
      if (typeof postId === "string") {
        // For MongoDB papers, extract numeric ID from OpenAlex URL
        const numericId = parseInt(postId.replace(/\D/g, ""));
        if (numericId) {
          router.push(`/forum/${numericId}`);
        } else {
          console.error("Could not extract numeric ID from:", postId);
        }
      } else {
        // For staff posts, navigate to staff forum
        router.push(`/forum/staff/${postId}`);
      }
    });
  };

  const handleComment = (postId: number | string) => {
    console.log("handleComment called with postId:", postId);
    requireAuth(async () => {
      console.log(
        "handleComment inside requireAuth, setting preview for postId:",
        postId
      );

      // Determine if this is a MongoDB paper or staff post based on the ID format
      // MongoDB papers have large numeric IDs (like 1971440513)
      // Staff posts have smaller numeric IDs (like 538703088)
      const isMongoDBPaper =
        typeof postId === "string" ||
        (typeof postId === "number" && postId > 1000000000);

      if (isMongoDBPaper) {
        // MongoDB paper - convert to a number for preview
        const numericId =
          typeof postId === "string"
            ? parseInt(postId.replace(/\D/g, ""))
            : postId;
        console.log(" Setting preview for MongoDB paper with ID:", numericId);
        setPreviewPostId(numericId);
        setPreviewPostType("regular");
        // No need to set targetId - ForumPage will construct it from postId
        setPreviewTargetId(null);
      } else {
        // Staff post - ensure it's a number
        const numericId =
          typeof postId === "string" ? parseInt(postId, 10) : postId;
        console.log(" Setting preview for staff post with ID:", numericId);
        setPreviewPostId(numericId);
        setPreviewPostType("staff");
        // No need to set targetId - ForumPage will construct it from postId
        setPreviewTargetId(null);
      }

      // Try to track activity, but don't let it block the preview
      try {
        if (typeof postId === "string") {
          // For MongoDB papers, extract numeric ID for activity tracking
          const numericId = parseInt(postId.replace(/\D/g, ""));
          if (numericId) {
            await activityTracker.trackImmediateActivity(numericId, "comment");
          }
        } else {
          // For staff posts, track activity
          await activityTracker.trackImmediateActivity(postId, "comment");
        }
      } catch (error) {
        console.warn(
          "Activity tracking failed, but continuing with comment preview:",
          error
        );
        // Don't let activity tracking failure prevent the comment preview from showing
      }
    });
  };

  const [feedHeight, setFeedHeight] = useState(600);
  const postGap = 24; // px
  const itemHeight = (isMobile ? 265 : 450) + postGap;
  useEffect(() => {
    // Account for bottom tab bar (56px) on mobile
    const bottomTabHeight = isMobile ? 56 : 0;
    setFeedHeight(window.innerHeight - 64 - bottomTabHeight);
  }, [isMobile]);

  return (
    <ForumLayout
      userId={userId}
      currentUser={undefined}
      onCreateStaffPost={() => setModalOpen(true)}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabs={tabs}
      selectedAlgorithm={selectedAlgorithm}
      onAlgorithmChange={(alg: string) => {
        setSelectedAlgorithm(alg);
        // Ensure explore feed reflects the selected algorithm immediately
        setExploreAlgorithm(alg as "seminal" | "relevance");
        exploreRefresh({ algorithm: alg as "seminal" | "relevance", page: 1 });
      }}
      selectedInterestsAlgorithm={selectedInterestsAlgorithm}
      onInterestsAlgorithmChange={setSelectedInterestsAlgorithm}
    >
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          height: "100vh",
          width: "100%",
          pt: 0,
          overflowY: "auto",
          // Remove transform to keep papers completely stationary
          transform: "translateY(0)",
        }}
      >
        {/* View All Papers button below top banner */}

        {/* Only render the main staff post feed */}
        <Box sx={{ width: "100%", flex: 1, position: "relative" }}>
          {error && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "50vh",
                textAlign: "center",
                px: 3,
              }}
            >
              <Typography color="error">{error}</Typography>
            </Box>
          )}

          {/* Loading State */}
          {loading && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "50vh",
                textAlign: "center",
                px: 3,
              }}
            >
              <Box sx={{ textAlign: "center" }}>
                <CircularProgress size={60} sx={{ mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Loading {activeTab === "explore" ? "trending" : "interests"}{" "}
                  posts...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Algorithm:{" "}
                  {activeTab === "explore"
                    ? selectedAlgorithm
                    : selectedInterestsAlgorithm}
                </Typography>
              </Box>
            </Box>
          )}

          {!error && !loading && posts.length > 0 && (
            <Virtuoso
              key={`${activeTab}-${activeTab === "explore" ? selectedAlgorithm : selectedInterestsAlgorithm}`}
              style={{ height: feedHeight, width: "100%" }}
              totalCount={
                highlightedPost
                  ? 1 + posts.filter((p) => p.id !== highlightedPost.id).length
                  : posts.length
              }
              data={
                highlightedPost
                  ? [
                      highlightedPost,
                      ...posts.filter((p) => p.id !== highlightedPost.id),
                    ]
                  : posts
              }
              itemContent={(index, post) => {
                console.log(` Rendering post at index ${index}:`, {
                  postId: post.id,
                  title: post.title?.substring(0, 50),
                  isHighlighted: index === 0 && highlightedPost?.id === post.id,
                });
                return (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", mb: 3 }}
                    data-testid="post-card"
                  >
                    <StaffPostCard
                      post={post as any}
                      likeCount={(post as any).likes}
                      liked={(post as any).liked}
                      onOpenForum={() => handleOpenForum(post.id)}
                      onComment={() => {
                        console.log(" Comment button clicked in home feed:", {
                          postId: post.id,
                          postData: post,
                        });
                        handleComment(post.id);
                      }}
                    />
                  </Box>
                );
              }}
              components={{
                Footer: () =>
                  // Show loading indicator or load more button at the bottom
                  activeTab === "explore" && loadingMore ? (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        py: 3,
                        minHeight: 100,
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 2 }}
                      >
                        <CircularProgress size={24} />
                        <Typography variant="body2" color="text.secondary">
                          Loading more papers...
                        </Typography>
                      </Box>
                    </Box>
                  ) : activeTab === "explore" && hasMore && !loadingMore ? (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        py: 3,
                        minHeight: 100,
                      }}
                    >
                      <Button
                        variant="outlined"
                        onClick={loadMore}
                        sx={{
                          px: 3,
                          py: 1.5,
                          borderRadius: 2,
                          textTransform: "none",
                          fontSize: "1rem",
                        }}
                      >
                        Load More Papers
                      </Button>
                    </Box>
                  ) : activeTab === "explore" &&
                    !hasMore &&
                    posts.length > 0 ? (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        py: 3,
                        minHeight: 100,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        You've reached the end of the feed
                      </Typography>
                    </Box>
                  ) : null,
              }}
              // Prevent jumping when new items are added
              followOutput={false}
              // Increase viewport to load more items before reaching bottom
              increaseViewportBy={{ top: 200, bottom: 200 }}
            />
          )}

          {/* Remove the separate infinite scroll loading indicator since it's now in Virtuoso Footer */}

          {/* Empty state */}
          {!error && !loading && posts.length === 0 && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "50vh",
                textAlign: "center",
                px: 3,
              }}
            >
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h6" color="text.secondary">
                  No {activeTab === "explore" ? "trending" : "interests"} posts
                  found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your filters or check back later
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
        {/* Modal for creating staff post */}
        <CreateStaffPostModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onPost={handleCreateStaffPost}
          posting={posting}
          error={postError}
        />
        {/* Right-hand side forum preview modal */}
        {typeof previewPostId === "number" && previewPostType && (
          <>
            {/* Backdrop */}
            <Box
              sx={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                bgcolor: isMobile
                  ? "rgba(0, 0, 0, 0.5)"
                  : "rgba(0, 0, 0, 0.09)",
                zIndex: 2999,
                ...(isMobile && {
                  backdropFilter: "blur(2px)",
                }),
              }}
              onClick={() => {
                setPreviewPostId(null);
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
                {mounted && isMobile && (
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
                  postId={previewPostId}
                  staffPostId={
                    previewPostType === "staff" ? previewPostId : undefined
                  }
                  targetId={previewTargetId}
                />
              </Box>
            </Box>
          </>
        )}
      </Box>

      {/* Mobile: Bottom tab bar for Explore/Research Interests */}
      {mounted && isMobile && (
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: "100vw",
            height: 56,
            bgcolor: "#fff",
            borderTop: "1px solid #e0e3e8",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            zIndex: 2000,
            boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",

            opacity: 1,

            pointerEvents: "auto",
          }}
        >
          <Button
            onClick={() => setActiveTab("explore")}
            sx={{
              flex: 1,
              fontWeight: 700,
              fontSize: 16,
              color: activeTab === "explore" ? "#1976d2" : "#888",
              borderRadius: 0,
              height: "100%",
              bgcolor: "transparent",
              borderBottom:
                activeTab === "explore" ? "3px solid #1976d2" : "none",
              boxShadow: "none",
              textTransform: "none",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
            disableRipple
          >
            Explore
            <Box
              component="span"
              onClick={(event: React.MouseEvent<HTMLElement>) => {
                event.stopPropagation();
                handleAlgorithmMenuOpen(event);
              }}
              sx={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 4px",
                borderRadius: "4px",
                backgroundColor: "rgba(25, 118, 210, 0.08)",
                border: "1px solid rgba(25, 118, 210, 0.2)",
                transition: "all 0.2s ease",
                "&:hover": {
                  backgroundColor: "rgba(25, 118, 210, 0.15)",
                  border: "1px solid rgba(25, 118, 210, 0.4)",
                  transform: "scale(1.05)",
                },
              }}
            >
              <KeyboardArrowDownIcon sx={{ fontSize: 16, color: "#1976d2" }} />
            </Box>
          </Button>
          <Button
            onClick={() => setActiveTab("interests")}
            sx={{
              flex: 1,
              fontWeight: 700,
              fontSize: 16,
              color: activeTab === "interests" ? "#1976d2" : "#888",
              borderRadius: 0,
              height: "100%",
              bgcolor: "transparent",
              borderBottom:
                activeTab === "interests" ? "3px solid #1976d2" : "none",
              boxShadow: "none",
              textTransform: "none",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
            disableRipple
          >
            Research Interests
            <Box
              component="span"
              onClick={(event: React.MouseEvent<HTMLElement>) => {
                event.stopPropagation();
                handleAlgorithmMenuOpen(event);
              }}
              sx={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 4px",
                borderRadius: "4px",
                backgroundColor: "rgba(25, 118, 210, 0.08)",
                border: "1px solid rgba(25, 118, 210, 0.2)",
                transition: "all 0.2s ease",
                "&:hover": {
                  backgroundColor: "rgba(25, 118, 210, 0.15)",
                  border: "1px solid rgba(25, 118, 210, 0.4)",
                  transform: "scale(1.05)",
                },
              }}
            >
              <KeyboardArrowDownIcon sx={{ fontSize: 16, color: "#1976d2" }} />
            </Box>
          </Button>
        </Box>
      )}

      {/* Algorithm dropdown menu */}
      <Menu
        anchorEl={algorithmAnchorEl}
        open={Boolean(algorithmAnchorEl)}
        onClose={handleAlgorithmMenuClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{
          "& .MuiPaper-root": {
            marginTop: "-30px", // Move menu up above the button
          },
        }}
      >
        <MenuItem
          sx={{
            color:
              (activeTab === "explore"
                ? selectedAlgorithm
                : selectedInterestsAlgorithm) === "relevance"
                ? "#1976d2"
                : "#000",
            fontWeight:
              (activeTab === "explore"
                ? selectedAlgorithm
                : selectedInterestsAlgorithm) === "relevance"
                ? 600
                : 400,
            fontSize: 16,
            "&:hover": {
              backgroundColor: "#f5f5f5",
            },
          }}
          onClick={() => {
            if (activeTab === "explore") {
              setSelectedAlgorithm("relevance");
              setExploreAlgorithm("relevance");
              exploreRefresh({ algorithm: "relevance", page: 1 });
            } else {
              setSelectedInterestsAlgorithm("relevance");
            }
            handleAlgorithmMenuClose();
          }}
        >
           Current
        </MenuItem>
        <MenuItem
          sx={{
            color:
              (activeTab === "explore"
                ? selectedAlgorithm
                : selectedInterestsAlgorithm) === "seminal"
                ? "#1976d2"
                : "#000",
            fontWeight:
              (activeTab === "explore"
                ? selectedAlgorithm
                : selectedInterestsAlgorithm) === "seminal"
                ? 600
                : 400,
            fontSize: 16,
            "&:hover": {
              backgroundColor: "#f5f5f5",
            },
          }}
          onClick={() => {
            if (activeTab === "explore") {
              setSelectedAlgorithm("seminal");
              setExploreAlgorithm("seminal");
              exploreRefresh({ algorithm: "seminal", page: 1 });
            } else {
              setSelectedInterestsAlgorithm("seminal");
            }
            handleAlgorithmMenuClose();
          }}
        >
           Seminal
        </MenuItem>
      </Menu>
    </ForumLayout>
  );
}

export default function HomeFeedPage(props: any) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeFeedPageContent {...props} />
    </Suspense>
  );
}

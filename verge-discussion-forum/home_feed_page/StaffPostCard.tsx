"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Image from "next/image";
import { StaffPost } from "../app/forum_feed_page/staffPostApi";
import Button from "@mui/material/Button";
import RepostModal from "./RepostModal";
import AddToProjectModal from "./AddToProjectModal";
import IconButton from "@mui/material/IconButton";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import { useSession } from "next-auth/react";
import {
  bookmarkStaffPost,
  unbookmarkStaffPost,
} from "../app/forum/commentApi";
import CommentIcon from "@mui/icons-material/Comment";
import { useRouter } from "next/navigation";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import Chip from "@mui/material/Chip";
import Popover from "@mui/material/Popover";
import ForumIcon from "@mui/icons-material/Forum";
import RepeatIcon from "@mui/icons-material/Repeat";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Snackbar from "@mui/material/Snackbar";
import IndividualPostNoteButton from "../app/saved/IndividualPostNoteButton";
import IndividualPostNoteModal from "../app/saved/IndividualPostNoteModal";
import { DesktopOnly } from "../app/components/MobileBlocker";
import { useStaffPostActivityTracking } from "../utils/activityTracker";
import { useLikes } from "../hooks/useLikes";
import { useBookmarks } from "../hooks/useBookmarks";
import { useBookmarksWithConfirmation } from "../hooks/useBookmarksWithConfirmation";
import { useUnbookmarkConfirmation } from "../app/contexts/UnbookmarkContext";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

interface StaffPostCardProps {
  post: StaffPost;
  hideRepostButton?: boolean;
  showBookmark?: boolean; // NEW PROP
  onOpenForum?: () => void; // NEW PROP
  onComment?: () => void; // NEW PROP
  hideActions?: boolean; // NEW PROP
  onUnbookmark?: () => void; // NEW PROP
  hideLikeButton?: boolean; // NEW PROP
  bookmarked?: boolean; // NEW PROP
  compact?: boolean;
  liked?: boolean; // NEW
  likeCount?: number; // NEW
  headerIcons?: React.ReactNode;
  onClick?: () => void; // NEW: Add click handler for the entire card
}

const StaffPostCard: React.FC<StaffPostCardProps> = (props) => {
  const {
    post,
    hideRepostButton,
    showBookmark = true,
    onOpenForum,
    onComment,
    hideActions = false,
    onUnbookmark,
    hideLikeButton = false,
    bookmarked: bookmarkedProp,
    compact = false,
    liked: likedProp, // NEW
    likeCount: likeCountProp, // NEW
    headerIcons,
    onClick,
  } = props;

  // Helper function to remove "openalex:" prefix from linkId
  const getCleanLink = (linkId: string | undefined | null) => {
    if (!linkId || typeof linkId !== "string") {
      // If no linkId, try to construct a URL from the post ID
      if (post?.id) {
        const postId = post.id.toString();
        // For OpenAlex papers, construct the URL
        if (postId.includes("openalex:")) {
          return postId.replace("openalex:", "https://openalex.org/");
        }
        // For other papers, try to construct a basic URL
        return `https://openalex.org/${postId}`;
      }
      return ""; // Return empty string if no fallback available
    }

    // Handle the case where linkId already contains a full URL
    if (linkId.startsWith("openalex:https://openalex.org/")) {
      // Extract just the ID part after the last slash
      const idPart = linkId.split("/").pop();
      return `https://openalex.org/${idPart}`;
    }

    if (linkId.startsWith("openalex:")) {
      return linkId.replace("openalex:", "https://openalex.org/");
    }

    return linkId;
  };

  // Early return if post is undefined
  if (!post) return null;
  const [repostOpen, setRepostOpen] = useState(false);
  const [addToProjectModalOpen, setAddToProjectModalOpen] = useState(false);
  const [individualNoteModalOpen, setIndividualNoteModalOpen] = useState(false);
  const [shouldOpenNoteModal, setShouldOpenNoteModal] = useState(false);
  const { data: session, status } = useSession();
  const userId = session?.userId; // Remove the fallback to test-user-1
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [savedInProjects, setSavedInProjects] = useState<any[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [summaryData, setSummaryData] = useState<{
    keyInsight?: string;
    methodology?: string[];
    broaderRelevance?: string;
    structured?: boolean;
  }>({});
  const [showingSummary, setShowingSummary] = useState(false);

  // The new AI summary format returns a single paragraph, not bullet points
  // We'll display it as a single text block

  // Use ref to track previous post ID to prevent infinite loops
  const prevPostIdRef = useRef<string | number | null>(null);

  // Debug post object
  console.log(" StaffPostCard post object:", {
    id: post?.id,
    idType: typeof post?.id,
    linkId: post?.linkId,
    title: post?.title?.substring(0, 50),
  });

  // Check if this is a MongoDB paper (has string ID or linkId with openalex format)
  const isMongoDBPaper =
    (typeof post.id === "string" && (post.id as string).length > 10) ||
    (post.linkId &&
      typeof post.linkId === "string" &&
      post.linkId.includes("openalex:"));

  // Determine target type based on paper type
  const targetType = isMongoDBPaper ? "mongodb_paper" : "staff_post";

  // Get the correct target ID - use linkId for MongoDB papers if id is not available
  const targetId = post?.id?.toString() || post?.linkId || "";

  console.log(" StaffPostCard target info:", {
    isMongoDBPaper,
    targetType,
    targetId,
    originalId: post?.id,
  });

  // Use the new likes hook for staff posts
  const {
    likeCount,
    liked,
    loading: likeLoading,
    handleLikeClick,
  } = useLikes({
    targetId: targetId,
    targetType: targetType,
    initialLikeCount: likeCountProp ?? 0,
    initialLiked: !!likedProp,
    skipInitialFetch: false, // Fetch like status on mount to ensure persistence
  });

  // Use the new bookmarks hook with confirmation for staff posts
  const {
    bookmarkCount,
    bookmarked,
    loading: bookmarkLoading,
    handleBookmarkClick,
    refreshBookmarkStatus,
    toggleBookmark,
  } = useBookmarksWithConfirmation({
    targetId: targetId,
    targetType: targetType,
    initialBookmarkCount: 0,
    initialBookmarked: !!bookmarkedProp, // Only set to true if actually bookmarked, not if in projects
    completePaperData: post, // NEW: Pass the complete post data
    skipInitialFetch: false,
    itemTitle: post?.title || "Unknown Post", // NEW: Title for confirmation dialog
    itemType: isMongoDBPaper ? "paper" : "post", // NEW: Type for confirmation dialog
    onBookmarkClick: () => {
      // Open the add to project modal for bookmarking
      setAddToProjectModalOpen(true);
    },
  });

  // Only show as bookmarked if actually in bookmarks collection
  // Posts in projects are handled separately and don't affect bookmark state
  const isBookmarked = bookmarked;

  // Visual state for bookmark button - show as bookmarked if in bookmarks OR in projects
  const showAsBookmarked = bookmarked || savedInProjects.length > 0;

  // Get the global unbookmark confirmation function
  const { showUnbookmarkConfirmation } = useUnbookmarkConfirmation();

  // Custom bookmark click handler that handles both bookmarks and projects with confirmation
  const handleBookmarkClickWithConfirmation = async () => {
    if (onUnbookmark) {
      // If we have an onUnbookmark callback, we're in the saved content area
      // Let the parent handle the API call
      console.log(
        "Unbookmarking via onUnbookmark callback (saved content area)"
      );
      onUnbookmark();
    } else {
      // We're in the home feed - show confirmation for any "saved" state
      if (showAsBookmarked) {
        // Show confirmation dialog for unbookmarking (includes items in projects)
        console.log(" Showing unbookmark confirmation for:", {
          targetId,
          title: post?.title,
          type: isMongoDBPaper ? "paper" : "post",
          bookmarked,
          savedInProjects: savedInProjects.length,
        });

        showUnbookmarkConfirmation({
          id: targetId,
          title: post?.title || "Unknown Post",
          type: isMongoDBPaper ? "paper" : "post",
          onConfirm: async () => {
            console.log(" Confirmation confirmed, handling unbookmark");
            if (bookmarked) {
              // If it's actually bookmarked, remove from bookmarks
              console.log("Unbookmarking post from home feed:", post.id);
              await toggleBookmark();
            } else if (savedInProjects.length > 0) {
              // If it's only in projects, remove from all projects
              console.log("Removing post from projects:", post.id);
              for (const project of savedInProjects) {
                try {
                  await fetch("/api/saved-categories/mongodb", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      categoryId: project.id,
                      targetId: targetId,
                      targetType: targetType,
                    }),
                  });
                } catch (error) {
                  console.error("Error removing from project:", error);
                }
              }
              // Refresh the projects list
              await checkIfInProjects();
            }
          },
        });
      } else {
        // Use the hook's bookmark handler for bookmarking
        handleBookmarkClick();
      }
    }
  };

  // Custom bookmark click handler that integrates with onUnbookmark callback
  const handleCustomBookmarkClick = async () => {
    if (onUnbookmark) {
      // If we have an onUnbookmark callback, we're in the saved content area
      // Let the parent handle the API call
      console.log(
        "Unbookmarking via onUnbookmark callback (saved content area)"
      );
      onUnbookmark();
    } else {
      // We're in the home feed
      if (showAsBookmarked) {
        // If the button shows as bookmarked, handle removal based on where it's saved
        if (bookmarked) {
          // If it's actually bookmarked, remove from bookmarks
          console.log("Unbookmarking post from home feed:", post.id);
          await toggleBookmark();
        } else if (savedInProjects.length > 0) {
          // If it's only in projects, remove from all projects
          console.log("Removing post from projects:", post.id);
          for (const project of savedInProjects) {
            try {
              await fetch("/api/saved-categories/mongodb", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  categoryId: project.id,
                  targetId: targetId,
                  targetType: targetType,
                }),
              });
            } catch (error) {
              console.error(
                "Error removing from project:",
                project.name,
                error
              );
            }
          }
          // Refresh the projects list
          await checkIfInProjects();
        }
      } else {
        // If not bookmarked, open the add to project modal
        console.log("Opening add to project modal for unbookmarked post");
        setAddToProjectModalOpen(true);
      }
    }
  };

  // Check if this post is in any project
  const checkIfInProjects = useCallback(async () => {
    if (!userId || !post?.id) return;

    try {
      const response = await fetch(
        `/api/saved-categories/mongodb?userId=${userId}`
      );
      if (response.ok) {
        const data = await response.json();
        const categories = data.categories || [];

        // Check if this post is in any category
        const postInProjects = categories.filter((cat: any) =>
          cat.staffPosts?.some(
            (staffPost: any) =>
              staffPost.targetId === post.id.toString() ||
              staffPost.id === post.id
          )
        );

        setSavedInProjects(postInProjects);
      }
    } catch (error) {
      console.error("Error checking if post is in projects:", error);
    }
  }, [userId, post?.id]);

  useEffect(() => {
    // Temporarily disabled to fix infinite loop
    // if (post?.id && userId && prevPostIdRef.current !== post.id) {
    //   prevPostIdRef.current = post.id;
    //   checkIfInProjects();
    // }
  }, [userId, post?.id, checkIfInProjects]);

  // Watch for shouldOpenNoteModal and open the note modal
  useEffect(() => {
    if (shouldOpenNoteModal && post?.id) {
      console.log(" Opening note modal for post:", post.id);
      setIndividualNoteModalOpen(true);
      setShouldOpenNoteModal(false);
    }
  }, [shouldOpenNoteModal, post?.id]);

  // Activity tracking for citation updates (only for regular staff posts)
  const { trackImmediateActivity } = useStaffPostActivityTracking(
    isMongoDBPaper ? 0 : post.id // Use 0 for MongoDB papers to disable tracking
  );

  // Citation popup state
  // const [citeAnchorEl, setCiteAnchorEl] = useState<null | HTMLElement>(null);
  // const [snackbarOpen, setSnackbarOpen] = useState(false);
  // const handleCiteClick = (event: React.MouseEvent<HTMLElement>) => {
  //   setCiteAnchorEl(event.currentTarget);
  // };
  // const handleCiteClose = () => {
  //   setCiteAnchorEl(null);
  // };
  // const handleCopyCitation = async () => {
  //   if (post.citation) {
  //     await navigator.clipboard.writeText(post.citation);
  //     setSnackbarOpen(true);
  //   }
  // };
  // const handleSnackbarClose = () => setSnackbarOpen(false);

  const requireAuth = (action: () => void) => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }
    action();
  };

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });

  if (isMobile) {
    // MOBILE CARD
    return (
      <Card
        onClick={(e) => {
          // Only trigger if onClick is provided and the click is not on an interactive element
          if (
            onClick &&
            !(e.target as HTMLElement).closest('button, a, [role="button"]')
          ) {
            e.stopPropagation();
            onClick();
          }
        }}
        sx={{
          borderRadius: 3,
          boxShadow: "0 2px 12px rgba(25, 118, 210, 0.07)",
          background: "linear-gradient(135deg, #fafdff 0%, #f3f7fa 100%)",
          border: "1.5px solid #e3f0fd",
          mb: { xs: 1, sm: 4 }, // 8px gap for mobile, 32px for desktop
          width: "calc(100vw - 8px)",
          maxWidth: 500,
          minWidth: 0,
          mx: "auto",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          minHeight: 150, // Increased to ensure buttons are visible
          height: "100%",
          cursor: onClick ? "pointer" : "default",
          "&:hover": onClick
            ? {
                boxShadow: "0 4px 16px rgba(25, 118, 210, 0.15)",
              }
            : {},
        }}
      >
        <CardContent
          sx={{
            pb: 1,
            width: "100%",
            px: { xs: 2, sm: 4 },
            pt: 1.5,
            flex: "1 1 auto",
          }}
        >
          {" "}
          {/* less padding */}
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
            <Avatar
              sx={{
                mr: 1,
                width: 40,
                height: 40,
                border: "2px solid #fff",
                bgcolor: "transparent",
              }}
            >
              <Image
                src="/vergesci_logo.jpeg"
                alt="VergeSci Logo"
                width={32}
                height={32}
                style={{ borderRadius: 16 }}
              />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, fontSize: 13, color: "black" }}
              >
                {post.journal || "VergeSci"}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: 11 }}
              >
                {post.createdAt
                  ? new Date(post.createdAt).toLocaleDateString()
                  : ""}
              </Typography>
            </Box>
            {headerIcons && (
              <Box sx={{ display: "flex", gap: 1, mr: 2 }}>{headerIcons}</Box>
            )}
            {
              /* Only show AI summary button if abstract is long enough */
              post.abstract && post.abstract.length >= 300 && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showingSummary) {
                      setShowingSummary(false);
                    } else if (aiSummary.length > 0) {
                      setShowingSummary(true);
                    } else {
                      // Generate summary
                      (async () => {
                        setSummaryLoading(true);
                        setSummaryError(null);
                        setAiSummary("");
                        setSummaryData({});
                        try {
                          const res = await fetch("/api/ai/summarize", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              paperId: post.linkId || post.id,
                              title: post.title,
                              abstract: post.abstract,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok)
                            throw new Error(
                              data?.error || "Failed to summarize"
                            );
                          setAiSummary(data?.aiSummary || "");
                          setSummaryData({
                            keyInsight: data?.keyInsight,
                            methodology: Array.isArray(data?.methodology)
                              ? data.methodology
                              : [],
                            broaderRelevance: data?.broaderRelevance,
                            structured: data?.structured,
                          });
                          setShowingSummary(true);
                        } catch (err: any) {
                          setSummaryError(
                            err?.message || "Failed to summarize"
                          );
                        } finally {
                          setSummaryLoading(false);
                        }
                      })();
                    }
                  }}
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: 11,
                    px: 1.5,
                    py: 0.5,
                    minWidth: 0,
                    bgcolor: "#1976d2",
                    color: "white",
                    "&:hover": { bgcolor: "#1565c0" },
                    mr: 7,
                  }}
                >
                  {summaryLoading
                    ? "Summarizing..."
                    : showingSummary
                      ? "View Abstract"
                      : "Summarize using Eureka"}
                </Button>
              )
            }
          </Box>
          <Divider sx={{ mb: 0.5, mt: 0.5, borderColor: "#e3f0fd" }} />
          {/* Title */}
          <Typography
            variant="subtitle1"
            sx={{
              mb: 0.25,
              fontWeight: 600,
              color: "#1976d2",
              fontSize: 20,
              pr: 2,
            }}
          >
            {post.title}
          </Typography>
          {/* Authors Chip */}
          <Box
            sx={{
              mb: 0.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            {post.authors && post.authors.length > 0 ? (
              <AuthorsDropdown authors={post.authors} />
            ) : null}
          </Box>
          {/* Publication Date & Cited By Count */}
          <Box sx={{ display: "flex", gap: 0.5, mb: 0.5, flexWrap: "wrap" }}>
            {post.publicationDate && (
              <Typography
                variant="caption"
                sx={{ fontSize: 11, fontWeight: 700, color: "black" }}
              >
                Published:{" "}
                {post.publicationDate
                  ? new Date(
                      post.publicationDate + "T00:00:00"
                    ).toLocaleDateString()
                  : ""}
              </Typography>
            )}
            <Typography
              variant="caption"
              sx={{ fontSize: 11, fontWeight: 700, color: "black" }}
            >
              Cited by: {post.citedByCount}
            </Typography>
          </Box>
          {/* Abstract */}
          <Typography
            variant="body2"
            sx={{
              mb: 0.25,
              fontWeight: 700,
              color: "#1976d2",
              fontSize: 13,
            }}
          >
            {showingSummary ? "Summary:" : "Abstract:"}
          </Typography>
          {summaryLoading ? (
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}
            >
              <CircularProgress size={16} />
              <Typography variant="body2" sx={{ fontSize: 13, color: "#666" }}>
                Generating summary...
              </Typography>
            </Box>
          ) : summaryError ? (
            <Alert severity="error" sx={{ mb: 0.5, fontSize: 12 }}>
              {summaryError}
            </Alert>
          ) : showingSummary && aiSummary.length > 0 ? (
            <Box sx={{ mb: 0.5 }}>
              {/* AI Summary */}
              <Typography
                variant="body2"
                sx={{
                  fontSize: 13,
                  lineHeight: 1.4,
                  color: "#222",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                  pr: 5,
                  mb: 0.5,
                }}
              >
                {aiSummary}
              </Typography>

              {/* Key Insight */}
              {summaryData.keyInsight && (
                <Box sx={{ mb: 0.5 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.5, fontSize: 13 }}
                  >
                    Key Insight
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: 13,
                      lineHeight: 1.4,
                      color: "#222",
                      wordWrap: "break-word",
                      overflowWrap: "break-word",
                      pr: 5,
                    }}
                  >
                    {summaryData.keyInsight}
                  </Typography>
                </Box>
              )}

              {/* Broader Relevance */}
              {summaryData.broaderRelevance && (
                <Box sx={{ mb: 0.5 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, mb: 0.5, fontSize: 13 }}
                  >
                    Broader Relevance
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: 13,
                      lineHeight: 1.4,
                      color: "#222",
                      wordWrap: "break-word",
                      overflowWrap: "break-word",
                      pr: 5,
                    }}
                  >
                    {summaryData.broaderRelevance}
                  </Typography>
                </Box>
              )}

              {/* Methodology chips - more compact for mobile */}
              {summaryData.methodology &&
                summaryData.methodology.length > 0 && (
                  <Box sx={{ mb: 0.5 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, mb: 0.5, fontSize: 13 }}
                    >
                      Methodology
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.25 }}>
                      {summaryData.methodology.map((method, i) => (
                        <Chip
                          key={i}
                          label={method}
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{ fontSize: 10, height: 20 }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

              {/* AI Summary Disclaimer */}
              <Typography
                variant="caption"
                sx={{
                  fontSize: 10,
                  color: "#666",
                  fontStyle: "italic",
                  mt: 0.5,
                  display: "block",
                  lineHeight: 1.3,
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  pr: 1,
                  maxWidth: "calc(100% - 8px)",
                  boxSizing: "border-box",
                }}
              >
                Eureka is an experiment. While we strive for accuracy, the
                information provided may contain mistakes and should be used
                with caution.
              </Typography>
            </Box>
          ) : (
            <Typography
              variant="body2"
              sx={{
                mb: 0.5,
                lineHeight: 1.4,
                color: "#222",
                fontSize: 13,
                wordBreak: "break-word",
                overflowWrap: "anywhere",
                whiteSpace: "normal",
                pr: 1,
                pl: 0,
                width: "calc(100% - 8px)",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              {post.abstract && post.abstract.length >= 300
                ? post.abstract
                : "Unavailable on OpenAlex. To learn more about this paper, click the DOI button below."}
            </Typography>
          )}
          {/* DOI and Link ID */}
          <Box sx={{ display: "flex", gap: 0.5, mb: 0.5 }}>
            {post.doi && (
              <Button
                variant="contained"
                color="primary"
                href={post.doi}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  borderRadius: 999,
                  px: 1,
                  py: 0.25,
                  fontWeight: 700,
                  fontSize: 11,
                  textTransform: "none",
                  minWidth: 0,
                  boxShadow: 0,
                  height: 24,
                }}
              >
                DOI
              </Button>
            )}
            {post.linkId && (
              <Button
                variant="contained"
                color="primary"
                href={getCleanLink(post.linkId) || "#"}
                target="_blank"
                rel="noopener noreferrer"
                disabled={!getCleanLink(post.linkId)}
                sx={{
                  borderRadius: 999,
                  px: 1,
                  py: 0.25,
                  fontWeight: 700,
                  fontSize: 11,
                  textTransform: "none",
                  minWidth: 0,
                  boxShadow: 0,
                  height: 24,
                }}
              >
                Source
              </Button>
            )}
          </Box>
          {/* Subfields */}
          {post.subfields && post.subfields.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.25, mb: 0.5 }}>
              {post.subfields.map((subfield: any, index: number) => {
                if (typeof subfield === "string") {
                  return (
                    <Chip
                      key={`${subfield}-${index}`}
                      label={subfield}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontSize: 10, height: 20 }}
                    />
                  );
                } else if (
                  subfield &&
                  typeof subfield === "object" &&
                  subfield.name
                ) {
                  return (
                    <Chip
                      key={subfield.id || subfield.name || index}
                      label={subfield.name}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontSize: 10, height: 20 }}
                    />
                  );
                } else {
                  return null;
                }
              })}
            </Box>
          )}
        </CardContent>
        {/* Actions - all icons, close together, touch-friendly */}
        <CardActions
          sx={{
            px: 0.5,
            pt: 0.5,
            pb: 0,
            gap: 0.25,
            justifyContent: "space-between",
            minHeight: 36,
            flexShrink: 0,
          }}
        >
          <IconButton
            onClick={handleLikeClick}
            disabled={likeLoading}
            sx={{
              color: liked ? "#1976d2" : "#b0b8c1",
              background: liked ? "#e3f0fd" : "transparent",
              borderRadius: 2,
              transition: "background 0.2s, color 0.2s",
              "&:hover": { background: "#e3f0fd", color: "#1976d2" },
              p: 0.5,
              fontSize: 18,
            }}
          >
            {liked ? (
              <FavoriteIcon fontSize="small" />
            ) : (
              <FavoriteBorderIcon fontSize="small" />
            )}
          </IconButton>
          <Typography
            variant="caption"
            sx={{
              minWidth: 12,
              textAlign: "center",
              color: "#1976d2",
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            {likeCount}
          </Typography>
          <IconButton
            onClick={handleBookmarkClickWithConfirmation}
            disabled={bookmarkLoading}
            sx={{
              color: showAsBookmarked ? "#1976d2" : "#b0b8c1",
              background: showAsBookmarked ? "#e3f0fd" : "transparent",
              borderRadius: 2,
              transition: "background 0.2s, color 0.2s",
              "&:hover": { background: "#e3f0fd", color: "#1976d2" },
              p: 0.5,
              fontSize: 18,
              mr: 1, // add right margin for spacing
            }}
          >
            {showAsBookmarked ? (
              <BookmarkIcon fontSize="small" />
            ) : (
              <BookmarkBorderIcon fontSize="small" />
            )}
          </IconButton>

          {/* Only show note button if post is in a project */}
          {savedInProjects.length > 0 && (
            <IndividualPostNoteButton
              type="staffPost"
              contentId={post.id}
              contentTitle={post.title}
              onNoteUpdate={() => {}}
              size="small"
            />
          )}
          {onComment && (
            <IconButton
              onClick={() => {
                console.log("Comment button clicked for post:", post.id);
                onComment();
              }}
              size="small"
              sx={{
                color: "#1976d2",
                background: "#e3f0fd",
                borderRadius: 2,
                "&:hover": { background: "#d2e6fa" },
                p: 0.5,
                fontSize: 18,
              }}
            >
              <CommentIcon fontSize="small" />
            </IconButton>
          )}
          {!hideRepostButton && (
            <IconButton
              onClick={() => requireAuth(() => setRepostOpen(true))}
              size="small"
              sx={{
                color: "#1976d2",
                background: "#e3f0fd",
                borderRadius: 2,
                "&:hover": { background: "#d2e6fa" },
                p: 0.5,
                fontSize: 18,
              }}
            >
              <RepeatIcon fontSize="small" />
            </IconButton>
          )}
          {onOpenForum && (
            <IconButton
              onClick={onOpenForum}
              size="small"
              sx={{
                color: "#1976d2",
                background: "#e3f0fd",
                borderRadius: 2,
                "&:hover": { background: "#d2e6fa" },
                p: 0.5,
                fontSize: 18,
                mr: 2.5, // add right margin to move away from edge
              }}
            >
              <ForumIcon fontSize="small" />
            </IconButton>
          )}
        </CardActions>
        {/* Repost Modal */}
        <RepostModal
          open={repostOpen}
          onClose={() => setRepostOpen(false)}
          staffPost={post}
        />
        {/* Add to Project Modal */}
        <AddToProjectModal
          open={addToProjectModalOpen}
          onClose={() => setAddToProjectModalOpen(false)}
          staffPostId={targetType === "staff_post" ? post.id : undefined}
          targetId={targetType === "mongodb_paper" ? targetId : undefined}
          targetType={targetType}
          completePaperData={post} // NEW: Pass complete paper data for fast bookmarking
          onAddToProject={async (projectId) => {
            console.log(" StaffPostCard - Adding to project:", {
              projectId,
              postId: post.id,
              postKeys: Object.keys(post),
              hasTitle: !!post.title,
              hasAbstract: !!post.abstract,
              hasAuthors: !!post.authors,
            });
            // Use the new MongoDB API
            try {
              await fetch("/api/saved-categories/mongodb", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  categoryId: projectId,
                  targetId: post.id.toString(),
                  targetType: "staff_post",
                  completeData: post,
                }),
              });
              // Refresh bookmark status after successful operation
              await refreshBookmarkStatus();
            } catch (error) {
              console.error("Error adding to project:", error);
            }
            setAddToProjectModalOpen(false);
          }}
          onCreateAndAdd={async (projectName) => {
            console.log("Created and added to project:", projectName);
            // The AddToProjectModal already handles the creation and adding
            // Just refresh bookmark status and close modal
            try {
              await refreshBookmarkStatus();
            } catch (error) {
              console.error("Error refreshing bookmark status:", error);
            }
            setAddToProjectModalOpen(false);

            // Set flag to open note modal after project modal closes
            console.log(" Setting shouldOpenNoteModal to true");
            setShouldOpenNoteModal(true);
          }}
          onSaveWithoutProject={async () => {
            console.log("Saved without project");
            // The AddToProjectModal already handles saving without project
            // Just refresh bookmark status and close modal
            try {
              await refreshBookmarkStatus();
            } catch (error) {
              console.error("Error refreshing bookmark status:", error);
            }
            setAddToProjectModalOpen(false);
          }}
        />
        {/* AI Summary Modal (Mobile) */}
      </Card>
    );
  }

  // Desktop card
  return (
    <Card
      onClick={(e) => {
        // Only trigger if onClick is provided and the click is not on an interactive element
        if (
          onClick &&
          !(e.target as HTMLElement).closest('button, a, [role="button"]')
        ) {
          e.stopPropagation();
          onClick();
        }
      }}
      sx={
        compact
          ? {
              borderRadius: 3,
              boxShadow: "0 2px 12px rgba(25, 118, 210, 0.07)",
              background: "linear-gradient(135deg, #fafdff 0%, #f3f7fa 100%)",
              border: "1.5px solid #e3f0fd",
              transition: "box-shadow 0.2s",
              mb: 4, // increased gap between posts
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              minHeight: 420, // Increased to ensure buttons are visible
              height: "100%",
              cursor: onClick ? "pointer" : "default",
              "&:hover": {
                boxShadow: "0 8px 24px rgba(25, 118, 210, 0.10)",
              },
            }
          : {
              borderRadius: 3,
              boxShadow: "0 2px 12px rgba(25, 118, 210, 0.07)",
              background: "linear-gradient(135deg, #fafdff 0%, #f3f7fa 100%)",
              border: "1.5px solid #e3f0fd",
              transition: "box-shadow 0.2s",
              mb: 4, // increased gap between posts
              width: {
                xs: "calc(100vw - 32px)",
                sm: "calc(100vw - 64px)",
                md: "calc(100vw - 96px)",
              },
              maxWidth: 950,
              minWidth: 0,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              minHeight: 420, // Increased to ensure buttons are visible
              height: "95%",
              cursor: onClick ? "pointer" : "default",
              "&:hover": {
                boxShadow: "0 8px 24px rgba(25, 118, 210, 0.10)",
              },
            }
      }
    >
      <CardContent
        sx={{
          pb: 0,
          width: "100%",
          px: { xs: 2, sm: 5 },
          pt: 3,
          flex: "1 1 auto",
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Avatar
            sx={{
              mr: 2,
              width: 56,
              height: 56,
              border: "2px solid #fff",
              bgcolor: "transparent",
            }}
          >
            <Image
              src="/vergesci_logo.jpeg"
              alt="VergeSci Logo"
              width={48}
              height={48}
              style={{ borderRadius: 24 }}
            />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, fontSize: 18, color: "black" }}
            >
              {post.journal || "VergeSci"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {post.createdAt
                ? new Date(post.createdAt).toLocaleDateString()
                : ""}
            </Typography>
          </Box>
          {headerIcons && (
            <Box sx={{ display: "flex", gap: 1, mr: 6 }}>{headerIcons}</Box>
          )}
          {
            /* Only show AI summary button if abstract is long enough */
            post.abstract && post.abstract.length >= 300 && (
              <Button
                variant="contained"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (showingSummary) {
                    setShowingSummary(false);
                  } else if (aiSummary.length > 0) {
                    setShowingSummary(true);
                  } else {
                    // Generate summary
                    (async () => {
                      setSummaryLoading(true);
                      setSummaryError(null);
                      setAiSummary("");
                      setSummaryData({});
                      try {
                        const res = await fetch("/api/ai/summarize", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            paperId: post.linkId || post.id,
                            title: post.title,
                            abstract: post.abstract,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok)
                          throw new Error(data?.error || "Failed to summarize");
                        setAiSummary(data?.aiSummary || "");
                        setSummaryData({
                          keyInsight: data?.keyInsight,
                          methodology: Array.isArray(data?.methodology)
                            ? data.methodology
                            : [],
                          broaderRelevance: data?.broaderRelevance,
                          structured: data?.structured,
                        });
                        setShowingSummary(true);
                      } catch (err: any) {
                        setSummaryError(err?.message || "Failed to summarize");
                      } finally {
                        setSummaryLoading(false);
                      }
                    })();
                  }
                }}
                sx={{
                  borderRadius: 2,
                  fontWeight: 600,
                  textTransform: "none",
                  bgcolor: "#1976d2",
                  color: "white",
                  px: 2,
                  "&:hover": { bgcolor: "#1565c0" },
                  mr: 7,
                }}
              >
                {summaryLoading
                  ? "Summarizing..."
                  : showingSummary
                    ? "View Abstract"
                    : "Summarize using Eureka"}
              </Button>
            )
          }
        </Box>
        <Divider sx={{ mb: 2, mt: 1, borderColor: "#e3f0fd" }} />

        {/* Title */}
        <Typography
          variant="h6"
          sx={{ mb: 1, fontWeight: 600, color: "#1976d2", pr: 8, fontSize: 26 }}
        >
          {post.title}
        </Typography>
        {/* Authors Chip */}
        <Box
          sx={{
            mb: 2,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {post.authors && post.authors.length > 0 ? (
            <AuthorsDropdown authors={post.authors} />
          ) : null}
        </Box>

        {/* Publication Date & Cited By Count */}
        <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
          {post.publicationDate && (
            <Typography
              variant="body2"
              sx={{ fontWeight: 700, color: "black" }}
            >
              Published:{" "}
              {post.publicationDate
                ? new Date(
                    post.publicationDate + "T00:00:00"
                  ).toLocaleDateString()
                : ""}
            </Typography>
          )}
          <Typography variant="body2" sx={{ fontWeight: 700, color: "black" }}>
            Cited by: {post.citedByCount}
          </Typography>
        </Box>

        {/* Abstract */}
        <Typography
          variant="h6"
          sx={{
            mb: 0.5,
            fontWeight: 700,
            color: "black",
            fontSize: 17,
          }}
        >
          {showingSummary ? "Summary:" : "Abstract:"}
        </Typography>
        {summaryLoading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body1" sx={{ fontSize: 17, color: "#666" }}>
              Generating summary...
            </Typography>
          </Box>
        ) : summaryError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {summaryError}
          </Alert>
        ) : showingSummary && aiSummary.length > 0 ? (
          <Box sx={{ mb: 2 }}>
            {/* AI Summary */}
            <Typography
              variant="body1"
              sx={{
                fontSize: 17,
                lineHeight: 1.7,
                color: "#222",
                wordWrap: "break-word",
                overflowWrap: "break-word",
                pr: 8,
                mb: 1,
              }}
            >
              {aiSummary}
            </Typography>

            {/* Key Insight */}
            {summaryData.keyInsight && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Key Insight
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: 17,
                    lineHeight: 1.7,
                    color: "#222",
                    wordWrap: "break-word",
                    overflowWrap: "break-word",
                    pr: 8,
                  }}
                >
                  {summaryData.keyInsight}
                </Typography>
              </Box>
            )}

            {/* Broader Relevance */}
            {summaryData.broaderRelevance && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Broader Relevance
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: 17,
                    lineHeight: 1.7,
                    color: "#222",
                    wordWrap: "break-word",
                    overflowWrap: "break-word",
                    pr: 8,
                  }}
                >
                  {summaryData.broaderRelevance}
                </Typography>
              </Box>
            )}

            {/* Methodology */}
            {summaryData.methodology && summaryData.methodology.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Methodology
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {summaryData.methodology.map((method, i) => (
                    <Chip
                      key={i}
                      label={method}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* AI Summary Disclaimer */}
            <Typography
              variant="caption"
              sx={{
                fontSize: 12,
                color: "#666",
                fontStyle: "italic",
                mt: 1,
                display: "block",
                lineHeight: 1.4,
                pr: 8,
              }}
            >
              Eureka is an experiment. While we strive for accuracy, the
              information provided may contain mistakes and should be used with
              caution.
            </Typography>
          </Box>
        ) : (
          <Typography
            variant="body1"
            sx={{
              mb: 2,
              lineHeight: 1.7,
              color: "#222",
              fontSize: 17,
              wordWrap: "break-word",
              overflowWrap: "break-word",
              whiteSpace: "pre-wrap",
              pr: 8,
              pl: 0,
            }}
          >
            {post.abstract && post.abstract.length >= 300
              ? post.abstract
              : "Unavailable on OpenAlex. To learn more about this paper, click the DOI button below."}
          </Typography>
        )}

        {/* DOI and Link ID */}
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
          {post.doi && (
            <Button
              variant="contained"
              color="primary"
              href={post.doi}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                borderRadius: 999,
                px: 2,
                py: 0.5,
                fontWeight: 700,
                fontSize: 14,
                textTransform: "none",
                minWidth: 0,
                boxShadow: 0,
              }}
            >
              DOI
            </Button>
          )}
          {post.linkId && (
            <Button
              variant="contained"
              color="primary"
              href={getCleanLink(post.linkId) || "#"}
              target="_blank"
              rel="noopener noreferrer"
              disabled={!getCleanLink(post.linkId)}
              sx={{
                borderRadius: 999,
                px: 2,
                py: 0.5,
                fontWeight: 700,
                fontSize: 14,
                textTransform: "none",
                minWidth: 0,
                boxShadow: 0,
              }}
            >
              Source
            </Button>
          )}
        </Box>

        {/* Subfields */}
        {post.subfields && post.subfields.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            {post.subfields.map((subfield: any, index: number) => {
              if (typeof subfield === "string") {
                return (
                  <Chip
                    key={`${subfield}-${index}`}
                    label={subfield}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                );
              } else if (
                subfield &&
                typeof subfield === "object" &&
                subfield.name
              ) {
                return (
                  <Chip
                    key={subfield.id || subfield.name || index}
                    label={subfield.name}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                );
              } else {
                return null;
              }
            })}
          </Box>
        )}
      </CardContent>

      <Divider sx={{ mt: 4, mb: 2 }} />

      {/* Actions */}
      <CardActions sx={{ px: 5, pt: 0, pb: 2, gap: 2, flexShrink: 0 }}>
        <IconButton
          onClick={handleLikeClick}
          disabled={likeLoading}
          sx={{
            color: liked ? "#1976d2" : "#b0b8c1",
            background: liked ? "#e3f0fd" : "transparent",
            borderRadius: 2,
            transition: "background 0.2s, color 0.2s",
            mr: 0.5,
            "&:hover": { background: "#e3f0fd", color: "#1976d2" },
          }}
        >
          {liked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
        </IconButton>
        <Typography
          variant="body2"
          sx={{
            mr: 2,
            minWidth: 18,
            textAlign: "center",
            color: "#1976d2",
            fontWeight: 600,
          }}
        >
          {likeCount}
        </Typography>

        <IconButton
          onClick={handleBookmarkClickWithConfirmation}
          disabled={bookmarkLoading}
          sx={{
            color: showAsBookmarked ? "#1976d2" : "#b0b8c1",
            background: showAsBookmarked ? "#e3f0fd" : "transparent",
            borderRadius: 2,
            transition: "background 0.2s, color 0.2s",
            mr: 0.5,
            "&:hover": { background: "#e3f0fd", color: "#1976d2" },
          }}
        >
          {showAsBookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
        </IconButton>

        <Box sx={{ flex: 1 }} />

        {onComment && (
          <IconButton
            onClick={onComment}
            size="small"
            sx={{
              mr: 1,
              color: "#1976d2",
              background: "#e3f0fd",
              borderRadius: 2,
              "&:hover": { background: "#d2e6fa" },
            }}
          >
            <CommentIcon />
          </IconButton>
        )}

        {!hideRepostButton && (
          <Button
            variant="outlined"
            size="small"
            sx={{
              mr: 1,
              borderRadius: 2,
              fontWeight: 600,
              borderColor: "#1976d2",
              color: "#1976d2",
              px: 2,
              "&:hover": { background: "#e3f0fd", borderColor: "#1976d2" },
            }}
            onClick={() => requireAuth(() => setRepostOpen(true))}
          >
            Repost
          </Button>
        )}

        {onOpenForum && (
          <Button
            variant="outlined"
            onClick={onOpenForum}
            size="small"
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              borderColor: "#1976d2",
              color: "#1976d2",
              px: 2,
              "&:hover": { background: "#e3f0fd", borderColor: "#1976d2" },
            }}
          >
            Open Forum
          </Button>
        )}
      </CardActions>

      {/* Repost Modal */}
      <RepostModal
        open={repostOpen}
        onClose={() => setRepostOpen(false)}
        staffPost={post}
      />
      {/* Add to Project Modal */}
      <AddToProjectModal
        open={addToProjectModalOpen}
        onClose={() => setAddToProjectModalOpen(false)}
        staffPostId={targetType === "staff_post" ? post.id : undefined}
        targetId={targetType === "mongodb_paper" ? targetId : undefined}
        targetType={targetType}
        completePaperData={post} // NEW: Pass complete paper data for fast bookmarking
        onAddToProject={async (projectId) => {
          console.log("Added to project:", projectId);
          // The AddToProjectModal already handles adding to existing projects
          // Just refresh bookmark status and close modal
          try {
            // Wait a bit for the project to be updated
            await new Promise((resolve) => setTimeout(resolve, 100));
            await refreshBookmarkStatus();
            // Refresh project information
            const response = await fetch(
              `/api/saved-categories/mongodb?userId=${userId}`
            );
            if (response.ok) {
              const data = await response.json();
              const categories = data.categories || [];
              const postInProjects = categories.filter((cat: any) =>
                cat.staffPosts?.some(
                  (staffPost: any) =>
                    staffPost.targetId === post.id.toString() ||
                    staffPost.id === post.id
                )
              );
              setSavedInProjects(postInProjects);
            }
            console.log(" Bookmark status refreshed after adding to project");
          } catch (error) {
            console.error("Error refreshing bookmark status:", error);
          }
          setAddToProjectModalOpen(false);
        }}
        onCreateAndAdd={async (projectName) => {
          console.log("Created and added to project:", projectName);
          // The AddToProjectModal already handles the creation and adding
          // Just refresh bookmark status and close modal
          try {
            // Wait a bit for the project to be updated
            await new Promise((resolve) => setTimeout(resolve, 100));
            await refreshBookmarkStatus();
            // Refresh project information
            const response = await fetch(
              `/api/saved-categories/mongodb?userId=${userId}`
            );
            if (response.ok) {
              const data = await response.json();
              const categories = data.categories || [];
              const postInProjects = categories.filter((cat: any) =>
                cat.staffPosts?.some(
                  (staffPost: any) =>
                    staffPost.targetId === post.id.toString() ||
                    staffPost.id === post.id
                )
              );
              setSavedInProjects(postInProjects);
            }
            console.log(" Bookmark status refreshed after creating project");
          } catch (error) {
            console.error("Error refreshing bookmark status:", error);
          }
          setAddToProjectModalOpen(false);
        }}
        onSaveWithoutProject={async () => {
          console.log("Saved without project");
          // The AddToProjectModal already handles saving without project
          // Just refresh bookmark status and close modal
          try {
            // Wait a bit for the bookmark to be saved
            await new Promise((resolve) => setTimeout(resolve, 100));
            await refreshBookmarkStatus();
            console.log(
              " Bookmark status refreshed after saving without project"
            );
          } catch (error) {
            console.error("Error refreshing bookmark status:", error);
          }
          setAddToProjectModalOpen(false);
        }}
      />

      {/* Individual Post Note Modal */}
      <IndividualPostNoteModal
        open={individualNoteModalOpen}
        onClose={() => {
          console.log(" Closing note modal");
          setIndividualNoteModalOpen(false);
        }}
        type="staffPost"
        contentId={post.id}
        contentTitle={post.title}
        onNoteUpdate={() => {
          console.log(" Note updated for post:", post.id);
          setIndividualNoteModalOpen(false);
        }}
      />
      {/* AI Summary Modal (Desktop) */}
    </Card>
  );
};

interface AuthorsDropdownProps {
  authors: string[] | Array<{ id: number; name: string; staffPostId: number }>;
}

const AuthorsDropdown: React.FC<AuthorsDropdownProps> = ({ authors }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? "authors-popover" : undefined;

  // Safety check for authors prop
  if (!authors || !Array.isArray(authors)) {
    return (
      <Chip
        label="Unknown Authors"
        color="primary"
        variant="outlined"
        sx={{ fontWeight: 600 }}
      />
    );
  }

  // Convert authors to strings if they're objects, with null checks
  const authorStrings = (authors || [])
    .filter((author) => author !== null && author !== undefined)
    .map((author) =>
      typeof author === "string" ? author : author?.name || "Unknown Author"
    );

  // Create the label based on number of authors
  const chipLabel =
    authorStrings.length === 0
      ? "Unknown Authors"
      : authorStrings.length === 1
        ? authorStrings[0]
        : `${authorStrings[0]}, et al.`;

  return (
    <>
      <Chip
        label={chipLabel}
        color="primary"
        variant="outlined"
        onClick={handleClick}
        sx={{ cursor: "pointer", fontWeight: 600 }}
        aria-describedby={id}
      />
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{ sx: { p: 2, minWidth: 180 } }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
            Authors
          </Typography>
          {authorStrings.map((author, idx) => (
            <Typography key={author + idx} variant="body2" sx={{ mb: 0.5 }}>
              {author}
            </Typography>
          ))}
        </Box>
      </Popover>
    </>
  );
};

export default StaffPostCard;

"use client";
import React, { useState, useEffect } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Image from "next/image";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import { useSession } from "next-auth/react";
import CommentIcon from "@mui/icons-material/Comment";
import { useRouter } from "next/navigation";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import Chip from "@mui/material/Chip";
import ForumIcon from "@mui/icons-material/Forum";
import RepeatIcon from "@mui/icons-material/Repeat";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Snackbar from "@mui/material/Snackbar";
import { StaffPostFormat } from "../../lib/mongodb-helpers";
import {
  likeMongoDBPaper,
  unlikeMongoDBPaper,
  bookmarkMongoDBPaper,
  unbookmarkMongoDBPaper,
  getMongoDBPaperLikeStatus,
  getMongoDBPaperBookmarkStatus,
  isMongoDBPaper,
} from "../../lib/mongodb-paper-interactions";

interface MongoDBPaperCardProps {
  paper: StaffPostFormat;
  onOpenForum?: () => void;
  onComment?: () => void;
  compact?: boolean;
}

const MongoDBPaperCard: React.FC<MongoDBPaperCardProps> = (props) => {
  const { paper, onOpenForum, onComment, compact = false } = props;

  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [likeCount, setLikeCount] = useState(paper.citedByCount || 0);
  const [liked, setLiked] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const { data: session, status } = useSession();
  const userId = session?.userId;
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });

  // Check if this is actually a MongoDB paper
  const isMongoDB = isMongoDBPaper(paper);

  // Debug logging in development
  if (process.env.NODE_ENV === "development") {
    console.log("MongoDBPaperCard render:", {
      paperId: paper.id,
      isMongoDB,
      paperTitle: paper.title?.substring(0, 50) + "...",
    });
  }

  // Load initial interaction status
  useEffect(() => {
    if (!isMongoDB || !paper.id) return;

    const loadInteractionStatus = async () => {
      try {
        const [likeStatus, bookmarkStatus] = await Promise.all([
          getMongoDBPaperLikeStatus(paper.id, userId),
          getMongoDBPaperBookmarkStatus(paper.id, userId),
        ]);

        setLikeCount(likeStatus.likeCount);
        setLiked(likeStatus.liked);
        setBookmarked(bookmarkStatus.bookmarked);
      } catch (error) {
        console.error("Error loading interaction status:", error);
      }
    };

    loadInteractionStatus();
  }, [paper.id, userId, isMongoDB]);

  const requireAuth = (action: () => void) => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }
    action();
  };

  const handleLike = async () => {
    if (!isMongoDB) return;

    requireAuth(async () => {
      if (!userId || !paper.id) return;

      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikeCount((prev) => (wasLiked ? Math.max(0, prev - 1) : prev + 1));

      try {
        const success = wasLiked
          ? await unlikeMongoDBPaper(userId, paper.id)
          : await likeMongoDBPaper(userId, paper.id);

        if (!success) {
          // Revert optimistic update
          setLiked(wasLiked);
          setLikeCount((prev) => (wasLiked ? prev + 1 : Math.max(0, prev - 1)));
          setSnackbarMessage("Failed to update like");
          setSnackbarOpen(true);
        }
      } catch (error) {
        // Revert optimistic update
        setLiked(wasLiked);
        setLikeCount((prev) => (wasLiked ? prev + 1 : Math.max(0, prev - 1)));
        setSnackbarMessage("Failed to update like");
        setSnackbarOpen(true);
      }
    });
  };

  const handleBookmark = async () => {
    if (!isMongoDB) return;

    requireAuth(async () => {
      if (!userId || !paper.id) return;

      const wasBookmarked = bookmarked;
      setBookmarked(!wasBookmarked);

      try {
        const success = wasBookmarked
          ? await unbookmarkMongoDBPaper(userId, paper.id)
          : await bookmarkMongoDBPaper(userId, paper.id);

        if (!success) {
          // Revert optimistic update
          setBookmarked(wasBookmarked);
          setSnackbarMessage("Failed to update bookmark");
          setSnackbarOpen(true);
        } else {
          setSnackbarMessage(
            wasBookmarked ? "Removed from bookmarks" : "Added to bookmarks"
          );
          setSnackbarOpen(true);
        }
      } catch (error) {
        // Revert optimistic update
        setBookmarked(wasBookmarked);
        setSnackbarMessage("Failed to update bookmark");
        setSnackbarOpen(true);
      }
    });
  };

  const handleCopyCitation = async () => {
    if (paper.citation) {
      try {
        await navigator.clipboard.writeText(paper.citation);
        setSnackbarMessage("Citation copied to clipboard");
        setSnackbarOpen(true);
      } catch (error) {
        setSnackbarMessage("Failed to copy citation");
        setSnackbarOpen(true);
      }
    }
  };

  const handleOpenPaper = () => {
    if (paper.doi) {
      window.open(`https://doi.org/${paper.doi}`, "_blank");
    }
  };

  // For papers from the MongoDB API, we can trust they are MongoDB papers
  // The isMongoDB check is mainly for safety, but we'll render anyway

  if (isMobile) {
    // Mobile layout
    return (
      <>
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: "0 2px 12px rgba(25, 118, 210, 0.07)",
            background: "linear-gradient(135deg, #fafdff 0%, #f3f7fa 100%)",
            border: "1.5px solid #e3f0fd",
            mb: 1,
            width: "calc(100vw - 8px)",
            maxWidth: 500,
            minWidth: 0,
            mx: "auto",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            minHeight: 150,
            height: "100%",
          }}
        >
          <CardContent
            sx={{ pb: 1, width: "100%", px: 2, pt: 1.5, flex: "1 1 auto" }}
          >
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
                  Research Paper
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "#666", fontSize: 11 }}
                >
                  {paper.publicationDate
                    ? new Date(
                        paper.publicationDate + "T00:00:00"
                      ).toLocaleDateString()
                    : ""}
                </Typography>
              </Box>
            </Box>

            {/* Title */}
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                fontSize: 16,
                lineHeight: 1.3,
                mb: 1,
                color: "#1a1a1a",
                cursor: "pointer",
                "&:hover": { color: "#1976d2" },
              }}
              onClick={handleOpenPaper}
            >
              {paper.title}
            </Typography>

            {/* Authors */}
            <Typography
              variant="body2"
              sx={{ color: "#666", mb: 1, fontSize: 12 }}
            >
              {paper.authors?.join(", ") || "Unknown authors"}
            </Typography>

            {/* Abstract */}
            <Typography
              variant="body2"
              sx={{
                color: "#444",
                fontSize: 13,
                lineHeight: 1.4,
                mb: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {paper.abstract}
            </Typography>

            {/* Subfields */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
              {paper.subfields?.slice(0, 3).map((subfield, index) => (
                <Chip
                  key={index}
                  label={subfield}
                  size="small"
                  sx={{
                    fontSize: 10,
                    height: 20,
                    bgcolor: "#e3f2fd",
                    color: "#1976d2",
                    "& .MuiChip-label": { px: 1 },
                  }}
                />
              ))}
            </Box>
          </CardContent>

          {/* Actions */}
          <CardActions sx={{ px: 2, pb: 1.5, pt: 0, gap: 1 }}>
            <IconButton
              onClick={handleLike}
              size="small"
              sx={{ color: liked ? "#e91e63" : "#666" }}
            >
              {liked ? (
                <FavoriteIcon fontSize="small" />
              ) : (
                <FavoriteBorderIcon fontSize="small" />
              )}
            </IconButton>
            <Typography variant="caption" sx={{ color: "#666", mr: 1 }}>
              {likeCount}
            </Typography>

            <IconButton
              onClick={handleBookmark}
              size="small"
              sx={{ color: bookmarked ? "#ff9800" : "#666" }}
            >
              {bookmarked ? (
                <BookmarkIcon fontSize="small" />
              ) : (
                <BookmarkBorderIcon fontSize="small" />
              )}
            </IconButton>

            <IconButton
              onClick={handleCopyCitation}
              size="small"
              sx={{ color: "#666" }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>

            <Box sx={{ flex: 1 }} />

            <Button
              variant="outlined"
              size="small"
              onClick={handleOpenPaper}
              sx={{
                fontSize: 11,
                px: 1.5,
                py: 0.5,
                borderColor: "#1976d2",
                color: "#1976d2",
                "&:hover": { bgcolor: "#1976d2", color: "white" },
              }}
            >
              View Paper
            </Button>
          </CardActions>
        </Card>

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={() => setSnackbarOpen(false)}
          message={snackbarMessage}
        />
      </>
    );
  }

  // Desktop layout
  return (
    <>
      <Card
        sx={{
          borderRadius: 4,
          boxShadow: "0 4px 20px rgba(25, 118, 210, 0.08)",
          background: "linear-gradient(135deg, #fafdff 0%, #f3f7fa 100%)",
          border: "2px solid #e3f0fd",
          mb: 4,
          width: "100%",
          maxWidth: 600,
          mx: "auto",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          minHeight: 200,
          height: "100%",
        }}
      >
        <CardContent
          sx={{ pb: 2, width: "100%", px: 4, pt: 2, flex: "1 1 auto" }}
        >
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <Avatar
              sx={{
                mr: 2,
                width: 48,
                height: 48,
                border: "2px solid #fff",
                bgcolor: "transparent",
              }}
            >
              <Image
                src="/vergesci_logo.jpeg"
                alt="VergeSci Logo"
                width={40}
                height={40}
                style={{ borderRadius: 20 }}
              />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, fontSize: 16, color: "black" }}
              >
                Research Paper
              </Typography>
              <Typography variant="body2" sx={{ color: "#666", fontSize: 13 }}>
                {new Date(paper.publicationDate).toLocaleDateString()} •{" "}
                {paper.citedByCount} citations
              </Typography>
            </Box>
          </Box>

          {/* Title */}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              fontSize: 20,
              lineHeight: 1.3,
              mb: 1.5,
              color: "#1a1a1a",
              cursor: "pointer",
              "&:hover": { color: "#1976d2" },
            }}
            onClick={handleOpenPaper}
          >
            {paper.title}
          </Typography>

          {/* Authors */}
          <Typography
            variant="body1"
            sx={{ color: "#666", mb: 1.5, fontSize: 14 }}
          >
            {paper.authors?.join(", ") || "Unknown authors"}
          </Typography>

          {/* Abstract */}
          <Typography
            variant="body1"
            sx={{
              color: "#444",
              fontSize: 14,
              lineHeight: 1.5,
              mb: 2,
              display: "-webkit-box",
              WebkitLineClamp: 4,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {paper.abstract}
          </Typography>

          {/* Subfields */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            {paper.subfields?.slice(0, 5).map((subfield, index) => (
              <Chip
                key={index}
                label={subfield}
                size="small"
                sx={{
                  fontSize: 11,
                  height: 24,
                  bgcolor: "#e3f2fd",
                  color: "#1976d2",
                  "& .MuiChip-label": { px: 1.5 },
                }}
              />
            ))}
          </Box>
        </CardContent>

        {/* Actions */}
        <CardActions sx={{ px: 4, pb: 2, pt: 0, gap: 2 }}>
          <IconButton
            onClick={handleLike}
            sx={{ color: liked ? "#e91e63" : "#666" }}
          >
            {liked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
          </IconButton>
          <Typography variant="body2" sx={{ color: "#666", mr: 2 }}>
            {likeCount}
          </Typography>

          <IconButton
            onClick={handleBookmark}
            sx={{ color: bookmarked ? "#ff9800" : "#666" }}
          >
            {bookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
          </IconButton>

          <IconButton onClick={handleCopyCitation} sx={{ color: "#666" }}>
            <ContentCopyIcon />
          </IconButton>

          <Box sx={{ flex: 1 }} />

          <Button
            variant="contained"
            onClick={handleOpenPaper}
            sx={{
              bgcolor: "#1976d2",
              color: "white",
              "&:hover": { bgcolor: "#1565c0" },
            }}
          >
            View Paper
          </Button>
        </CardActions>
      </Card>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </>
  );
};

export default MongoDBPaperCard;

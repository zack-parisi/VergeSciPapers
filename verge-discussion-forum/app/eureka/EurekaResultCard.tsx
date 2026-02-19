"use client";
import React, { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Typography,
  Paper,
  Modal,
  TextField,
  CircularProgress,
} from "@mui/material";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import RepeatIcon from "@mui/icons-material/Repeat";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ArticleIcon from "@mui/icons-material/Article";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AddToProjectModal from "../../home_feed_page/AddToProjectModal";
import EurekaPaperStaffCard from "./EurekaPaperStaffCard";

interface EurekaResultCardProps {
  message: {
    content: string;
    metadata?: {
      mode?: string;
      notes?: string[];
      clarifications?: string[];
    };
    papers?: any[];
    timestamp: Date;
    id?: string; // Stable ID for Eureka responses
  };
  query?: string; // Add query parameter
  index: number;
  children: React.ReactNode;
  onFindPapers?: () => void;
  findPapersState?: {
    loading?: boolean;
    error?: string;
    fetched?: boolean;
  };
}

export default function EurekaResultCard({
  message,
  query,
  index,
  children,
  onFindPapers,
  findPapersState,
}: EurekaResultCardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareContent, setShareContent] = useState("");
  const [addToProjectModalOpen, setAddToProjectModalOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [papersExpanded, setPapersExpanded] = useState(false);

  // Use the stable ID from the message, or generate one if not present
  const eurekaResultId = message.id || `eureka:${Date.now()}-${index}`;

  // Complete Eureka response data
  const eurekaData = {
    content: message.content,
    metadata: message.metadata,
    papers: message.papers,
    timestamp: message.timestamp,
    query: query || "",
  };

  // Check if this Eureka response is bookmarked
  const checkBookmarkStatus = async () => {
    if (!session?.userId) return;
    try {
      const response = await fetch(
        `/api/mongodb/bookmarks?userId=${session.userId}&targetId=${eurekaResultId}&targetType=eureka_result`
      );
      if (response.ok) {
        const data = await response.json();
        setBookmarked(data.bookmarked || false);
      }
    } catch (error) {
      console.error("Error checking bookmark status:", error);
    }
  };

  // Check bookmark status on mount
  React.useEffect(() => {
    checkBookmarkStatus();
  }, [session?.userId, eurekaResultId]);

  const handleShare = () => {
    if (!session?.user) {
      router.push("/login");
      return;
    }
    setShareModalOpen(true);
  };

  const handleShareSubmit = async () => {
    if (!session?.userId) return;

    try {
      const response = await fetch("/api/eureka/reposts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session.userId,
          content: shareContent,
          eurekaData: {
            id: eurekaResultId, // Include stable ID
            content: message.content,
            metadata: message.metadata,
            // Exclude papers from repost
            timestamp: message.timestamp,
            query: query || message.content, // Use the actual query from the user
          },
        }),
      });

      if (response.ok) {
        setShareModalOpen(false);
        setShareContent("");
        // Could add a success toast here
      } else {
        console.error("Failed to share Eureka result");
      }
    } catch (error) {
      console.error("Error sharing Eureka result:", error);
    }
  };

  const handleSave = () => {
    if (!session?.user) {
      router.push("/login");
      return;
    }
    setAddToProjectModalOpen(true);
  };

  const refreshBookmarkStatus = async () => {
    await checkBookmarkStatus();
  };

  return (
    <Box sx={{ position: "relative" }}>
      {/* Display the query if available */}
      {query && (
        <Box sx={{ mb: 2, position: "relative" }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              background: "#1976d2",
              borderRadius: "12px 12px 4px 12px",
              color: "white",
              maxWidth: "100%",
              overflow: "hidden",
              position: "relative",
              boxSizing: "border-box",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 1.5,
                alignItems: { xs: "flex-start", sm: "center" },
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                  whiteSpace: "normal",
                  wordWrap: "break-word",
                  flex: 1,
                }}
              >
                {query}
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                  justifyContent: { xs: "flex-start", sm: "flex-end" },
                }}
              >
                <Button
                  size="small"
                  variant="contained"
                  onClick={onFindPapers}
                  disabled={!onFindPapers || findPapersState?.loading}
                  sx={{
                    textTransform: "none",
                    fontWeight: 600,
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    color: "white",
                    "&:hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.3)",
                    },
                  }}
                >
                  {findPapersState?.loading ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <CircularProgress size={16} sx={{ color: "white" }} />
                      Fetching...
                    </Box>
                  ) : findPapersState?.fetched ? (
                    "Refresh Papers"
                  ) : (
                    "Find Papers"
                  )}
                </Button>

                {/* Save Button */}
                <IconButton
                  size="small"
                  onClick={handleSave}
                  disabled={bookmarkLoading}
                  sx={{
                    color: "white",
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    "&:hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.3)",
                    },
                  }}
                >
                  {bookmarked ? (
                    <BookmarkIcon fontSize="small" />
                  ) : (
                    <BookmarkBorderIcon fontSize="small" />
                  )}
                </IconButton>

                {/* Repost Button */}
                <IconButton
                  onClick={handleShare}
                  size="small"
                  sx={{
                    color: "white",
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    "&:hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.3)",
                    },
                  }}
                >
                  <RepeatIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Papers Section - Under header, above response, collapsed by default */}
      {message.papers && message.papers.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: 2,
              border: "1px solid rgba(25, 118, 210, 0.12)",
            }}
          >
            <Box
              onClick={() => setPapersExpanded(!papersExpanded)}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                "&:hover": {
                  backgroundColor: "rgba(25, 118, 210, 0.04)",
                },
                borderRadius: 1,
                p: 1,
                transition: "background-color 0.2s",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <ArticleIcon sx={{ fontSize: 20, color: "#1976d2" }} />
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, color: "#1976d2" }}
                >
                  {message.papers.length} Related Papers
                </Typography>
              </Box>
              <IconButton size="small" sx={{ color: "#1976d2" }}>
                {papersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={papersExpanded}>
              <Box
                sx={{
                  mt: 2,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2.5,
                }}
              >
                {message.papers.map((paper, paperIndex) => (
                  <EurekaPaperStaffCard
                    key={paperIndex}
                    paper={paper}
                    index={paperIndex}
                  />
                ))}
              </Box>
            </Collapse>
          </Paper>
        </Box>
      )}

      {/* Action buttons for when query is not available */}
      {!query && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 16,
            display: "flex",
            gap: 1,
            alignItems: "center",
            zIndex: 10,
          }}
        >
          {/* Save Button */}
          <IconButton
            size="small"
            onClick={handleSave}
            disabled={bookmarkLoading}
            sx={{
              color: bookmarked ? "#1976d2" : "#666",
              backgroundColor: bookmarked
                ? "rgba(25, 118, 210, 0.1)"
                : "transparent",
              "&:hover": {
                backgroundColor: bookmarked
                  ? "rgba(25, 118, 210, 0.2)"
                  : "rgba(0, 0, 0, 0.04)",
              },
            }}
          >
            {bookmarked ? (
              <BookmarkIcon fontSize="small" />
            ) : (
              <BookmarkBorderIcon fontSize="small" />
            )}
          </IconButton>

          {/* Repost Button */}
          <IconButton
            onClick={handleShare}
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
        </Box>
      )}

      {/* Render the original Eureka content */}
      {children}

      {/* Share Modal */}
      {shareModalOpen && (
        <Modal open={shareModalOpen} onClose={() => setShareModalOpen(false)}>
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              bgcolor: "rgba(0,0,0,0.7)",
              zIndex: 2100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 2,
            }}
          >
            <Box
              sx={{
                bgcolor: "white",
                color: "#181c24",
                borderRadius: 3,
                width: "100%",
                maxWidth: 800,
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              }}
            >
              {/* Header with close button */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 3,
                  pb: 2,
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "#1976d2" }}
                >
                  Create Repost
                </Typography>
                <IconButton
                  onClick={() => setShareModalOpen(false)}
                  sx={{
                    color: "#666",
                    "&:hover": { bgcolor: "#f5f5f5" },
                  }}
                  aria-label="Close"
                >
                  <CloseIcon />
                </IconButton>
              </Box>

              {/* Input section */}
              <Box sx={{ p: 3, pb: 2 }}>
                <Box sx={{ position: "relative" }}>
                  <TextField
                    label="Add your thoughts..."
                    variant="outlined"
                    multiline
                    minRows={2}
                    maxRows={4}
                    value={shareContent}
                    onChange={(e) => setShareContent(e.target.value)}
                    fullWidth
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        pr: 6,
                      },
                      "& .MuiInputLabel-root": {
                        color: "#666",
                      },
                    }}
                    placeholder="Share your thoughts on this result..."
                  />
                  <IconButton
                    onClick={handleShareSubmit}
                    disabled={!shareContent.trim()}
                    sx={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: shareContent.trim() ? "#1976d2" : "#ccc",
                      bgcolor: shareContent.trim() ? "#e3f2fd" : "transparent",
                      "&:hover": {
                        bgcolor: shareContent.trim()
                          ? "#bbdefb"
                          : "transparent",
                      },
                    }}
                  >
                    <SendIcon />
                  </IconButton>
                </Box>

                {/* Keyboard shortcut hint */}
                <Typography
                  variant="caption"
                  sx={{ mt: 1, color: "#666", display: "block" }}
                >
                  Press Enter or click send to post
                </Typography>
              </Box>

              {/* Divider */}
              <Box sx={{ px: 3, pb: 2 }}>
                <Box sx={{ height: 1, bgcolor: "#f0f0f0" }} />
              </Box>

              {/* Preview section */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  px: 3,
                  pb: 3,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ mb: 2, color: "#666", fontWeight: 600 }}
                >
                  Reposting:
                </Typography>
                {/* Display the query */}
                {query && (
                  <Box sx={{ mb: 2 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        background: "#1976d2",
                        borderRadius: "12px 12px 4px 12px",
                        color: "white",
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {query}
                      </Typography>
                    </Paper>
                  </Box>
                )}
                {/* Render the Eureka result preview */}
                {children}
              </Box>
            </Box>
          </Box>
        </Modal>
      )}

      {/* Add to Project Modal */}
      <AddToProjectModal
        open={addToProjectModalOpen}
        onClose={() => setAddToProjectModalOpen(false)}
        targetId={eurekaResultId}
        targetType="eureka_result"
        completePaperData={eurekaData}
        onAddToProject={async (projectId) => {
          console.log(" EurekaResultCard - Adding to project:", {
            projectId,
            eurekaResultId,
          });
          try {
            await fetch("/api/saved-categories/mongodb", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                categoryId: projectId,
                targetId: eurekaResultId,
                targetType: "eureka_result",
                completeData: eurekaData,
              }),
            });
            await refreshBookmarkStatus();
          } catch (error) {
            console.error("Error adding to project:", error);
          }
          setAddToProjectModalOpen(false);
        }}
        onCreateAndAdd={async (projectName) => {
          console.log("Created and added to project:", projectName);
          try {
            await refreshBookmarkStatus();
          } catch (error) {
            console.error("Error refreshing bookmark status:", error);
          }
          setAddToProjectModalOpen(false);
        }}
        onSaveWithoutProject={async () => {
          console.log("Saved without project");
          try {
            await refreshBookmarkStatus();
          } catch (error) {
            console.error("Error refreshing bookmark status:", error);
          }
          setAddToProjectModalOpen(false);
        }}
      />
    </Box>
  );
}

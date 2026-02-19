"use client";
import React, { useState, useEffect } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Typography from "@mui/material/Typography";
import { StaffPost } from "../app/forum_feed_page/staffPostApi";
import StaffPostCard from "./StaffPostCard";
import PersonIcon from "@mui/icons-material/Person";
import { useSession } from "next-auth/react";
import SendIcon from "@mui/icons-material/Send";
import InstitutionEmailModal from "../app/components/InstitutionEmailModal";

interface RepostModalProps {
  open: boolean;
  onClose: () => void;
  staffPost: StaffPost;
}

async function createRepost(
  userId: string,
  staffPostId: string,
  content: string
) {
  const res = await fetch("/api/reposts/mongodb", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, staffPostId, content }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(
      errorData.message || errorData.error || "Failed to create repost"
    );
  }
  return res.json();
}

// Utility to truncate text to a word limit
function truncateText(text: string, wordLimit = 50) {
  if (!text) return "";
  const words = text.split(" ");
  if (words.length <= wordLimit) return text;
  return words.slice(0, wordLimit).join(" ") + "...";
}

const RepostModal: React.FC<RepostModalProps> = ({
  open,
  onClose,
  staffPost,
}) => {
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstitutionModal, setShowInstitutionModal] = useState(false);
  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";

  // Fetch the real user profile from the backend
  const [profileUser, setProfileUser] = useState<any>(null);
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/profile/mongodb/${userId}`)
      .then((res) => res.json())
      .then((data) => setProfileUser(data))
      .catch(() => setProfileUser(null));
  }, [userId]);

  const handlePost = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    setError(null);
    try {
      // Convert staff post ID to string to ensure compatibility
      const staffPostId = staffPost.id?.toString();
      await createRepost(userId, staffPostId, comment);
      setComment("");
      onClose();
    } catch (e: any) {
      if (
        e.message?.includes("Institution email required") ||
        e.message?.includes("institution email")
      ) {
        setShowInstitutionModal(true);
      } else {
        setError(e.message || "Failed to repost");
      }
    } finally {
      setPosting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handlePost();
    }
  };

  // Create a truncated version of the staff post for the modal
  const truncatedStaffPost = {
    ...staffPost,
    abstract: truncateText(staffPost.abstract || "", 50),
  };

  return (
    <>
      <Modal open={open} onClose={onClose}>
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
                onClick={onClose}
                sx={{
                  color: "#666",
                  "&:hover": { bgcolor: "#f5f5f5" },
                }}
                aria-label="Close"
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {/* User info and input section */}
            <Box sx={{ p: 3, pb: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: "#1976d2",
                    width: 40,
                    height: 40,
                    mr: 2,
                    fontWeight: 600,
                    fontSize: 16,
                  }}
                >
                  {profileUser?.firstName && profileUser?.lastName
                    ? `${profileUser.firstName[0]}${profileUser.lastName[0]}`.toUpperCase()
                    : profileUser?.firstName?.[0] ||
                      profileUser?.name?.[0] || (
                        <PersonIcon sx={{ fontSize: 20 }} />
                      )}
                </Avatar>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, color: "#333" }}
                >
                  {profileUser?.firstName && profileUser?.lastName
                    ? `${profileUser.firstName} ${profileUser.lastName}`
                    : profileUser?.name || "User"}
                </Typography>
              </Box>

              {/* Comment input with integrated send button */}
              <Box sx={{ position: "relative" }}>
                <TextField
                  label="Add your thoughts..."
                  variant="outlined"
                  multiline
                  minRows={2}
                  maxRows={4}
                  value={comment}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setComment(e.target.value)
                  }
                  onKeyPress={handleKeyPress}
                  disabled={posting}
                  fullWidth
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      pr: 6, // Space for the send button
                    },
                    "& .MuiInputLabel-root": {
                      color: "#666",
                    },
                  }}
                  placeholder="Share your thoughts on this post..."
                />
                <IconButton
                  onClick={handlePost}
                  disabled={posting || !comment.trim()}
                  sx={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: comment.trim() ? "#1976d2" : "#ccc",
                    bgcolor: comment.trim() ? "#e3f2fd" : "transparent",
                    "&:hover": {
                      bgcolor: comment.trim() ? "#bbdefb" : "transparent",
                    },
                    "&:disabled": {
                      color: "#ccc",
                      bgcolor: "transparent",
                    },
                  }}
                >
                  <SendIcon />
                </IconButton>
              </Box>

              {error && (
                <Typography color="error" sx={{ mt: 1, fontSize: 14 }}>
                  {error}
                </Typography>
              )}

              {/* Keyboard shortcut hint */}
              <Typography
                variant="caption"
                sx={{ mt: 1, color: "#666", display: "block" }}
              >
                Press ⌘+Enter to post
              </Typography>
            </Box>

            {/* Divider */}
            <Box sx={{ px: 3, pb: 2 }}>
              <Box sx={{ height: 1, bgcolor: "#f0f0f0" }} />
            </Box>

            {/* Staff post content */}
            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                px: 3,
                pb: 3,
                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "#f1f1f1",
                  borderRadius: "3px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "#c1c1c1",
                  borderRadius: "3px",
                  "&:hover": {
                    background: "#a8a8a8",
                  },
                },
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ mb: 2, color: "#666", fontWeight: 600 }}
              >
                Reposting:
              </Typography>
              <StaffPostCard post={truncatedStaffPost} />
            </Box>
          </Box>
        </Box>
      </Modal>

      <InstitutionEmailModal
        open={showInstitutionModal}
        onClose={() => setShowInstitutionModal(false)}
        action="create reposts"
      />
    </>
  );
};

export default RepostModal;

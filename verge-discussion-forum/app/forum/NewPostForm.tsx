"use client";
import React, { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import PersonIcon from "@mui/icons-material/Person";
import { usePostComment } from "./useComments";
import InstitutionEmailModal from "../components/InstitutionEmailModal";

interface NewPostFormProps {
  postId?: number;
  staffPostId?: number;
  grantId?: number | string;
  targetId?: string; // NEW: Add targetId parameter
  userId: string;
  currentUser?: {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  };
  onPost?: () => void;
}

export default function NewPostForm({
  postId,
  staffPostId,
  grantId,
  targetId, // NEW: Add targetId parameter
  userId,
  currentUser,
  onPost,
}: NewPostFormProps) {
  console.log(" NewPostForm received props:", {
    postId,
    staffPostId,
    grantId,
    targetId,
    userId,
  });
  const [content, setContent] = useState("");
  const { submit, loading, error, institutionEmailError } = usePostComment(
    postId,
    userId,
    onPost,
    staffPostId,
    grantId,
    targetId // NEW: Pass targetId to the hook
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (content.trim()) {
      await submit(content);
      setContent("");
    }
  };

  // Extract first and last name for avatar and display
  let firstName = currentUser?.firstName || "";
  let lastName = currentUser?.lastName || "";
  let initials = "";
  if (firstName && lastName) {
    initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
  } else if (firstName) {
    initials = firstName[0].toUpperCase();
  } else if (currentUser?.name) {
    initials = currentUser.name[0].toUpperCase();
  } else if (currentUser?.id) {
    initials = currentUser.id[0].toUpperCase();
  }
  const displayName =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : currentUser?.name || currentUser?.id || "";

  return (
    <>
      <Box sx={{ width: "100%" }}>
        {/* Profile row at the top of the form */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Avatar
            sx={{
              bgcolor: "#1976d2",
              width: 40,
              height: 40,
              mr: 1,
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            {initials || <PersonIcon sx={{ fontSize: 22 }} />}
          </Avatar>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, color: "#1976d2", fontSize: 16 }}
          >
            {displayName}
          </Typography>
        </Box>
        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <TextField
            label="What's on your mind?"
            variant="outlined"
            multiline
            minRows={1}
            maxRows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={loading}
            sx={{ borderRadius: 3, mb: 1, width: "100%", fontSize: 14 }}
            InputProps={{ sx: { borderRadius: 3, fontSize: 14 } }}
            InputLabelProps={{ sx: { fontSize: 14 } }}
            inputProps={{ style: { resize: "none", fontSize: 14 } }}
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            sx={{ borderRadius: 3, px: 3, py: 0.5, fontSize: 13 }}
          >
            {loading ? "Posting..." : "Post"}
          </Button>
          {error && (
            <Typography color="error" sx={{ mt: 1, fontSize: 12 }}>
              {error}
            </Typography>
          )}
        </form>
      </Box>

      <InstitutionEmailModal
        open={institutionEmailError}
        onClose={() => {}} // The modal will be controlled by the hook
        action="post comments"
      />
    </>
  );
}

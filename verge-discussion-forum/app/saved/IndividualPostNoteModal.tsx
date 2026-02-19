"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
} from "@mui/material";
import { useSession } from "next-auth/react";

interface IndividualPostNoteModalProps {
  open: boolean;
  onClose: () => void;
  type: "post" | "staffPost" | "grant";
  contentId: number | string;
  contentTitle?: string;
  onNoteUpdate?: () => void;
}

const IndividualPostNoteModal: React.FC<IndividualPostNoteModalProps> = ({
  open,
  onClose,
  type,
  contentId,
  contentTitle,
  onNoteUpdate,
}) => {
  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";

  console.log("IndividualPostNoteModal received props:", {
    open,
    type,
    contentId,
    contentTitle,
    userId,
  });
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing note when modal opens
  useEffect(() => {
    console.log(
      "IndividualPostNoteModal useEffect - open:",
      open,
      "contentId:",
      contentId
    );
    if (open && contentId) {
      loadNote();
    }
  }, [open, contentId]);

  const loadNote = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/saved-notes?userId=${userId}&type=${type}&contentId=${contentId}`
      );
      const data = await response.json();
      setContent(data.note?.content || "");
    } catch (error) {
      console.error("Error loading note:", error);
      setContent("");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate required fields
      if (
        !userId ||
        !type ||
        !contentId ||
        (typeof contentId === "number" && contentId === 0) ||
        !content
      ) {
        console.error("Invalid note data:", {
          userId,
          type,
          contentId,
          content,
        });
        console.log("Note modal will close due to invalid data");
        onClose();
        return;
      }

      const requestBody = {
        userId,
        type,
        contentId,
        content,
      };

      console.log("Saving note with data:", requestBody);

      const response = await fetch("/api/saved-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Response status:", response.status);

      if (response.ok) {
        const responseData = await response.json();
        console.log("Note saved successfully:", responseData);
        if (onNoteUpdate) onNoteUpdate();
        onClose();
      } else {
        const errorData = await response.json();
        console.error(
          "Failed to save note. Status:",
          response.status,
          "Error:",
          errorData
        );
      }
    } catch (error) {
      console.error("Error saving note:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!content.trim()) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/saved-notes", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          type,
          contentId,
        }),
      });

      if (response.ok) {
        if (onNoteUpdate) onNoteUpdate();
        onClose();
      } else {
        console.error("Failed to delete note");
      }
    } catch (error) {
      console.error("Error deleting note:", error);
    } finally {
      setSaving(false);
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case "post":
        return "Post";
      case "staffPost":
        return "Staff Post";
      case "grant":
        return "Grant";
      default:
        return "Content";
    }
  };

  return (
    <>
      {/* Custom backdrop that covers everything including sticky top bar */}
      {open && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            bgcolor: "rgba(0, 0, 0, 0.6)",
            zIndex: 5999, // Higher than project modal backdrop but lower than dialog
          }}
          onClick={onClose}
        />
      )}
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        sx={{
          zIndex: 6000, // Higher than the project modal (5000)
          "& .MuiDialog-paper": {
            zIndex: 5000, // Higher than the custom backdrop (3999)
            position: "relative",
            bgcolor: "#fff", // Ensure white background
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          },
          "& .MuiBackdrop-root": {
            display: "none", // Hide the default backdrop since we're using custom one
          },
        }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minHeight: 400,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" component="div">
            {contentTitle
              ? `Notes for: ${contentTitle}`
              : `${getTypeLabel()} Notes`}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ mb: 2 }}>
            <TextField
              multiline
              rows={12}
              fullWidth
              variant="outlined"
              placeholder="Add your notes here..."
              value={content}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setContent(e.target.value)
              }
              disabled={loading}
              sx={{
                "& .MuiOutlinedInput-root": {
                  fontSize: "14px",
                  lineHeight: 1.5,
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose} disabled={saving} sx={{ mr: 1 }}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={saving || loading}
            color="error"
            sx={{ mr: 1 }}
          >
            Delete
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || loading}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default IndividualPostNoteModal;

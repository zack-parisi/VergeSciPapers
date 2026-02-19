"use client";
import React, { useState, useEffect } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import NoteIcon from "@mui/icons-material/Note";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import IndividualPostNoteModal from "./IndividualPostNoteModal";
import { useSession } from "next-auth/react";

interface IndividualPostNoteButtonProps {
  type: "post" | "staffPost" | "grant";
  contentId: number | string;
  contentTitle?: string;
  onNoteUpdate?: () => void;
  size?: "small" | "medium" | "large";
}

const IndividualPostNoteButton: React.FC<IndividualPostNoteButtonProps> = ({
  type,
  contentId,
  contentTitle,
  onNoteUpdate,
  size = "small",
}) => {
  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";
  const [hasNote, setHasNote] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if content has a note
  useEffect(() => {
    checkNoteStatus();
  }, [contentId, userId]);

  const checkNoteStatus = async () => {
    if (!contentId || !userId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/saved-notes?userId=${userId}&type=${type}&contentId=${contentId}`
      );
      const data = await response.json();
      setHasNote(!!data.note);
    } catch (error) {
      console.error("Error checking note status:", error);
      setHasNote(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    setModalOpen(true);
  };

  const handleNoteUpdate = () => {
    // Immediately check note status when note is updated
    setTimeout(() => {
      checkNoteStatus();
    }, 50);
    if (onNoteUpdate) onNoteUpdate();
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    // Refresh note status after modal closes
    setTimeout(() => {
      checkNoteStatus();
    }, 100);
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        disabled={loading}
        size={size}
        title={hasNote ? "View/Edit Notes" : "Add Notes"}
        sx={{
          color: hasNote ? "#666" : "#666",
          bgcolor: hasNote ? "rgba(102, 102, 102, 0.1)" : "transparent",
          borderRadius: "50%",
          width: 28,
          height: 28,
          minWidth: 28,
          minHeight: 28,
          boxShadow: hasNote ? "0 2px 8px rgba(102, 102, 102, 0.15)" : "none",
          transition: "all 0.2s",
          "&:hover": {
            color: hasNote ? "#333" : "#1976d2",
            bgcolor: hasNote
              ? "rgba(102, 102, 102, 0.15)"
              : "rgba(25, 118, 210, 0.08)",
            boxShadow: hasNote
              ? "0 4px 12px rgba(102, 102, 102, 0.2)"
              : "0 4px 12px rgba(25, 118, 210, 0.2)",
          },
        }}
      >
        {hasNote ? (
          <NoteIcon fontSize="small" />
        ) : (
          <NoteAddIcon fontSize="small" />
        )}
      </IconButton>

      <IndividualPostNoteModal
        open={modalOpen}
        onClose={handleCloseModal}
        type={type}
        contentId={contentId}
        contentTitle={contentTitle}
        onNoteUpdate={handleNoteUpdate}
      />
    </>
  );
};

export default IndividualPostNoteButton;

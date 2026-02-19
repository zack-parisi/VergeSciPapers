"use client";
import React, { useState, useEffect } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import NoteIcon from "@mui/icons-material/Note";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import ProjectNoteModal from "./ProjectNoteModal";

interface ProjectNoteButtonProps {
  categoryId: number;
  categoryName: string;
  onNoteUpdate?: () => void;
  size?: "small" | "medium" | "large";
}

const ProjectNoteButton: React.FC<ProjectNoteButtonProps> = ({
  categoryId,
  categoryName,
  onNoteUpdate,
  size = "small",
}) => {
  const [hasNote, setHasNote] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if project has a note
  useEffect(() => {
    checkNoteStatus();
  }, [categoryId]);

  const checkNoteStatus = async () => {
    if (!categoryId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/saved-categories/${categoryId}/note`);
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
    checkNoteStatus();
    if (onNoteUpdate) onNoteUpdate();
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        disabled={loading}
        size={size}
        title={hasNote ? "View/Edit Project Notes" : "Add Project Notes"}
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

      <ProjectNoteModal
        open={modalOpen}
        onClose={handleCloseModal}
        categoryId={categoryId}
        categoryName={categoryName}
        onNoteUpdate={handleNoteUpdate}
      />
    </>
  );
};

export default ProjectNoteButton;

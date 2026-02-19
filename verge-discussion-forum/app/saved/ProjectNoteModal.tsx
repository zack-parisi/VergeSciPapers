"use client";
import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import { useSession } from "next-auth/react";

interface ProjectNoteModalProps {
  open: boolean;
  onClose: () => void;
  categoryId: number;
  categoryName: string;
  onNoteUpdate?: () => void;
}

const ProjectNoteModal: React.FC<ProjectNoteModalProps> = ({
  open,
  onClose,
  categoryId,
  categoryName,
  onNoteUpdate,
}) => {
  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";
  const [note, setNote] = useState("");
  const [originalNote, setOriginalNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [hasNote, setHasNote] = useState(false);
  const [individualPostNotes, setIndividualPostNotes] = useState<
    Array<{
      type: string;
      contentId: number | string;
      content: string;
      title?: string;
    }>
  >([]);

  // Fetch existing note when modal opens
  useEffect(() => {
    if (open && categoryId) {
      // First fetch the project note, then fetch individual notes with proper title mapping
      fetchNote().then(() => {
        fetchIndividualPostNotes();
      });
    }
  }, [open, categoryId]);

  const fetchNote = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/saved-categories/${categoryId}/note?userId=${userId}`
      );
      const data = await response.json();

      if (data.note) {
        setNote(data.note.content);
        setOriginalNote(data.note.content);
        setHasNote(true);
      } else {
        setNote("");
        setOriginalNote("");
        setHasNote(false);
      }

      // Individual notes are handled by fetchIndividualPostNotes() with proper title mapping
    } catch (err: any) {
      setError("Failed to load note");
      console.error("Error fetching note:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchIndividualPostNotes = async () => {
    try {
      console.log(
        " Fetching individual notes for project:",
        categoryId,
        "userId:",
        userId
      );

      // First, get the project data to see what content is in this project
      const projectResponse = await fetch(
        `/api/saved-categories/mongodb?userId=${userId}`
      );
      const projectData = await projectResponse.json();
      const currentProject = projectData.categories?.find(
        (cat: any) => cat.id === categoryId
      );

      if (!currentProject) {
        console.log(" Project not found:", categoryId);
        setIndividualPostNotes([]);
        return;
      }

      // Get all individual notes
      const response = await fetch(`/api/saved-notes?userId=${userId}`);
      const data = await response.json();
      console.log(" Individual notes response:", data);

      const projectIndividualNotes: Array<{
        type: string;
        contentId: number | string;
        content: string;
        title?: string;
      }> = [];

      // Create mappings for content IDs to titles
      const projectContentIds = new Set();
      const contentTitleMap = new Map();

      // Add staff post IDs and titles
      if (currentProject.staffPosts) {
        currentProject.staffPosts.forEach((post: any) => {
          const contentId = post.targetId || post.staffPostId || post.id;
          const title = post.staffPost?.title || post.title || "Staff Post";
          projectContentIds.add(contentId);
          contentTitleMap.set(contentId, title);
        });
      }

      // Add post IDs and titles
      if (currentProject.posts) {
        currentProject.posts.forEach((post: any) => {
          const contentId = post.targetId || post.postId || post.id;
          const title =
            post.post?.content?.substring(0, 50) + "..." ||
            post.content?.substring(0, 50) + "..." ||
            "Post";
          projectContentIds.add(contentId);
          contentTitleMap.set(contentId, title);
        });
      }

      // Add grant IDs and titles
      if (currentProject.grants) {
        currentProject.grants.forEach((grant: any) => {
          const contentId = grant.targetId || grant.grantId || grant.id;
          const title = grant.grant?.title || grant.title || "Grant";
          projectContentIds.add(contentId);
          contentTitleMap.set(contentId, title);
        });
      }

      console.log(" Project content IDs:", Array.from(projectContentIds));
      console.log(" Content title map:", Object.fromEntries(contentTitleMap));

      // Filter notes to only include those for content in this project
      if (data.staffPostNotes) {
        for (const note of data.staffPostNotes) {
          if (projectContentIds.has(note.targetId)) {
            projectIndividualNotes.push({
              type: "staffPost",
              contentId: note.targetId,
              content: note.content,
              title: contentTitleMap.get(note.targetId) || "Staff Post",
            });
          }
        }
      }

      if (data.postNotes) {
        for (const note of data.postNotes) {
          if (projectContentIds.has(note.targetId)) {
            projectIndividualNotes.push({
              type: "post",
              contentId: note.targetId,
              content: note.content,
              title: contentTitleMap.get(note.targetId) || "Post",
            });
          }
        }
      }

      if (data.grantNotes) {
        for (const note of data.grantNotes) {
          if (projectContentIds.has(note.targetId)) {
            projectIndividualNotes.push({
              type: "grant",
              contentId: note.targetId,
              content: note.content,
              title: contentTitleMap.get(note.targetId) || "Grant",
            });
          }
        }
      }

      console.log(
        " Filtered project individual notes:",
        projectIndividualNotes
      );
      setIndividualPostNotes(projectIndividualNotes);
    } catch (error) {
      console.error("Error fetching individual post notes:", error);
    }
  };

  const handleSave = async () => {
    if (!note.trim()) {
      setError("Note cannot be empty");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const method = hasNote ? "PUT" : "POST";
      const response = await fetch(`/api/saved-categories/${categoryId}/note`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: note.trim(), userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save note");
      }

      const data = await response.json();
      setOriginalNote(data.note.content);
      setHasNote(true);
      setIsEditing(false);
      if (onNoteUpdate) onNoteUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to save note");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!hasNote) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/saved-categories/${categoryId}/note?userId=${userId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete note");
      }

      setNote("");
      setOriginalNote("");
      setHasNote(false);
      setIsEditing(false);
      if (onNoteUpdate) onNoteUpdate();
    } catch (err: any) {
      setError(err.message || "Failed to delete note");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNote(originalNote);
    setIsEditing(false);
    setError("");
  };

  const handleClose = () => {
    setNote(originalNote);
    setIsEditing(false);
    setError("");
    onClose();
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
            zIndex: 3999, // Higher than sticky top bar (2001) but lower than dialog
          }}
          onClick={handleClose}
        />
      )}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        sx={{
          zIndex: 5000, // Higher than the custom backdrop (3999)
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
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#1976d2" }}>
              Project Notes: {categoryName}
            </Typography>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {error && (
            <Typography color="error" sx={{ mb: 2, fontSize: 14 }}>
              {error}
            </Typography>
          )}

          {loading ? (
            <Typography sx={{ color: "#666", fontStyle: "italic" }}>
              Loading...
            </Typography>
          ) : (
            <Box>
              {!isEditing && hasNote ? (
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{ color: "#666", fontWeight: 600 }}
                    >
                      Current Note
                    </Typography>
                    <Box>
                      <IconButton
                        onClick={() => setIsEditing(true)}
                        size="small"
                        sx={{ color: "#1976d2" }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={handleDelete}
                        size="small"
                        sx={{ color: "#d32f2f" }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: "#f8f9fa",
                      borderRadius: 2,
                      border: "1px solid #e9ecef",
                      minHeight: 100,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <Typography variant="body1">{note}</Typography>
                  </Box>

                  {/* Individual Post Notes Section */}
                  {individualPostNotes.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ color: "#666", fontWeight: 600, mb: 2 }}
                      >
                        Individual Post Notes ({individualPostNotes.length})
                      </Typography>
                      <Box
                        sx={{
                          bgcolor: "#f0f4f8",
                          borderRadius: 2,
                          border: "1px solid #e3e8ed",
                          p: 2,
                          maxHeight: 300,
                          overflowY: "auto",
                        }}
                      >
                        {individualPostNotes.map((note, index) => (
                          <Box key={index} sx={{ mb: 2 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "#1976d2",
                                fontWeight: 600,
                                display: "block",
                                mb: 0.5,
                              }}
                            >
                              {note.title}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "#333",
                                fontSize: "0.875rem",
                                lineHeight: 1.4,
                                whiteSpace: "pre-wrap",
                                bgcolor: "#fff",
                                p: 1,
                                borderRadius: 1,
                                border: "1px solid #e3e8ed",
                              }}
                            >
                              {note.content}
                            </Typography>
                            {index < individualPostNotes.length - 1 && (
                              <Box sx={{ height: 8 }} />
                            )}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: "#666", fontWeight: 600, mb: 2 }}
                  >
                    {hasNote ? "Edit Note" : "Add Note"}
                  </Typography>
                  <TextField
                    autoFocus
                    multiline
                    rows={6}
                    value={note}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNote(e.target.value)
                    }
                    placeholder="Add your notes, reminders, or additional information about this project..."
                    fullWidth
                    variant="outlined"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ color: "#666", mt: 1, display: "block" }}
                  >
                    Use this space to add personal notes, reminders, or any
                    additional information about your project.
                  </Typography>

                  {/* Individual Post Notes Section */}
                  {individualPostNotes.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ color: "#666", fontWeight: 600, mb: 2 }}
                      >
                        Individual Post Notes ({individualPostNotes.length})
                      </Typography>
                      <Box
                        sx={{
                          bgcolor: "#f0f4f8",
                          borderRadius: 2,
                          border: "1px solid #e3e8ed",
                          p: 2,
                          maxHeight: 300,
                          overflowY: "auto",
                        }}
                      >
                        {individualPostNotes.map((note, index) => (
                          <Box key={index} sx={{ mb: 2 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "#1976d2",
                                fontWeight: 600,
                                display: "block",
                                mb: 0.5,
                              }}
                            >
                              {note.title}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "#333",
                                fontSize: "0.875rem",
                                lineHeight: 1.4,
                                whiteSpace: "pre-wrap",
                                bgcolor: "#fff",
                                p: 1,
                                borderRadius: 1,
                                border: "1px solid #e3e8ed",
                              }}
                            >
                              {note.content}
                            </Typography>
                            {index < individualPostNotes.length - 1 && (
                              <Box sx={{ height: 8 }} />
                            )}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          {isEditing && (
            <Button
              onClick={handleCancel}
              disabled={loading}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Cancel
            </Button>
          )}
          {isEditing && (
            <Button
              onClick={handleSave}
              disabled={loading || !note.trim()}
              variant="contained"
              startIcon={<SaveIcon />}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              {loading ? "Saving..." : "Save Note"}
            </Button>
          )}
          {!isEditing && !hasNote && (
            <Button
              onClick={handleSave}
              disabled={loading || !note.trim()}
              variant="contained"
              startIcon={<SaveIcon />}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              {loading ? "Saving..." : "Add Note"}
            </Button>
          )}
          {!isEditing && hasNote && (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outlined"
              startIcon={<EditIcon />}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Edit Note
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProjectNoteModal;

"use client";
import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import AddIcon from "@mui/icons-material/Add";
import BookmarkIcon from "@mui/icons-material/Bookmark";

import IconButton from "@mui/material/IconButton";
import { useSession } from "next-auth/react";
import { useSavedCategories } from "../saved/useSavedCategories";
import { bookmarkStaffPost, unbookmarkStaffPost } from "../forum/commentApi";

interface ForumFeedAddToProjectModalProps {
  open: boolean;
  onClose: () => void;
  postId: number;
  staffPostId?: number;
  onAddToProject: (projectId: number) => void;
  onCreateAndAdd: (projectName: string) => void;
  onSaveWithoutProject: () => void;
}

const ForumFeedAddToProjectModal: React.FC<ForumFeedAddToProjectModalProps> = ({
  open,
  onClose,
  postId,
  staffPostId,
  onAddToProject,
  onCreateAndAdd,
  onSaveWithoutProject,
}) => {
  console.log("ForumFeedAddToProjectModal received:", {
    postId,
    staffPostId,
    open,
  });
  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";
  const [newProjectName, setNewProjectName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    categories,
    fetchCategories,
    createCategory,
    addPostToCategory,
    loading: categoriesLoading,
  } = useSavedCategories(userId);

  useEffect(() => {
    if (open && userId) {
      fetchCategories();
    }
  }, [open, userId, fetchCategories]);

  const handleAddToExistingProject = async (projectId: number) => {
    setLoading(true);
    setError("");
    try {
      await addPostToCategory(projectId, postId, "post");
      onAddToProject(projectId);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add to project");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newProjectName.trim()) {
      setError("Project name cannot be empty");
      return;
    }

    // Prevent multiple calls while loading
    if (loading) {
      console.log("Already creating project, ignoring duplicate call");
      return;
    }

    setLoading(true);
    setError("");
    try {
      console.log(
        "Creating new project via parent handler:",
        newProjectName.trim()
      );
      // Let the parent component handle project creation
      await onCreateAndAdd(newProjectName.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWithoutProject = async () => {
    setLoading(true);
    setError("");
    try {
      await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, postId }),
      });
      onSaveWithoutProject();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save post");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewProjectName("");
    setShowCreateForm(false);
    setError("");
    onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        sx={{
          "& .MuiDialog-paper": {
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#1976d2", pb: 1 }}>
          Save to Project
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ mb: 3, color: "#666" }}>
            Choose how you&apos;d like to save this post. You can add it to an
            existing project, create a new project, or save it without
            organizing it into a project.
          </Typography>

          {error && (
            <Typography color="error" sx={{ mb: 2, fontSize: 14 }}>
              {error}
            </Typography>
          )}

          {/* Save without project option */}
          <Box sx={{ mb: 3 }}>
            <Card
              onClick={loading ? undefined : handleSaveWithoutProject}
              sx={{
                cursor: loading ? "not-allowed" : "pointer",
                borderRadius: 2,
                border: "2px solid #e3f0fd",
                transition: "all 0.2s",
                opacity: loading ? 0.6 : 1,
                "&:hover": {
                  borderColor: loading ? "#e3f0fd" : "#1976d2",
                  boxShadow: loading
                    ? "none"
                    : "0 4px 12px rgba(25, 118, 210, 0.15)",
                },
              }}
            >
              <CardContent sx={{ p: 2, textAlign: "center" }}>
                <BookmarkIcon sx={{ fontSize: 32, color: "#1976d2", mb: 1 }} />
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "#1976d2" }}
                >
                  Save without Project
                </Typography>
                <Typography variant="body2" sx={{ color: "#666", mt: 0.5 }}>
                  Save this post to your bookmarks without organizing it into a
                  project
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Create New Project */}
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Create New Project
          </Typography>

          {!showCreateForm ? (
            <Card
              onClick={() => setShowCreateForm(true)}
              sx={{
                cursor: "pointer",
                borderRadius: 2,
                border: "2px dashed #1976d2",
                transition: "all 0.2s",
                "&:hover": {
                  borderColor: "#1976d2",
                  boxShadow: "0 4px 12px rgba(25, 118, 210, 0.15)",
                },
              }}
            >
              <CardContent sx={{ p: 2, textAlign: "center" }}>
                <AddIcon sx={{ fontSize: 32, color: "#1976d2", mb: 1 }} />
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "#1976d2" }}
                >
                  Create New Project
                </Typography>
                <Typography variant="body2" sx={{ color: "#666", mt: 0.5 }}>
                  Create a new project and add this post to it
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Card sx={{ borderRadius: 2, border: "2px solid #1976d2" }}>
              <CardContent sx={{ p: 2 }}>
                <TextField
                  autoFocus
                  label="Project Name"
                  value={newProjectName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewProjectName(e.target.value)
                  }
                  fullWidth
                  size="small"
                  sx={{
                    mb: 2,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                    },
                  }}
                />
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    variant="contained"
                    onClick={handleCreateAndAdd}
                    disabled={loading || !newProjectName.trim()}
                    sx={{
                      borderRadius: 2,
                      textTransform: "none",
                      fontWeight: 600,
                    }}
                  >
                    {loading ? "Creating..." : "Create & Add"}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setShowCreateForm(false)}
                    disabled={loading}
                    sx={{
                      borderRadius: 2,
                      textTransform: "none",
                      fontWeight: 600,
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Existing Projects */}
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Existing Projects
          </Typography>

          {categoriesLoading ? (
            <Typography sx={{ color: "#666", fontStyle: "italic" }}>
              Loading projects...
            </Typography>
          ) : categories.length === 0 ? (
            <Typography sx={{ color: "#666", fontStyle: "italic", mb: 2 }}>
              No projects yet. Create your first project above.
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: 2,
              }}
            >
              {categories.map((project) => (
                <Card
                  key={project.id}
                  sx={{
                    borderRadius: 2,
                    border: "2px solid #e3f0fd",
                    transition: "all 0.2s",
                    opacity: loading ? 0.6 : 1,
                    "&:hover": {
                      borderColor: loading ? "#e3f0fd" : "#1976d2",
                      boxShadow: loading
                        ? "none"
                        : "0 4px 12px rgba(25, 118, 210, 0.15)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        mb: 2,
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 600, color: "#1976d2", flex: 1 }}
                      >
                        {project.name}
                      </Typography>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleAddToExistingProject(project.id)}
                          disabled={loading}
                          sx={{
                            borderRadius: 2,
                            textTransform: "none",
                            fontWeight: 600,
                          }}
                        >
                          Add
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={handleClose}
            disabled={loading}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ForumFeedAddToProjectModal;

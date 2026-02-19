"use client";
import React, { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import IconButton from "@mui/material/IconButton";
import NoteIcon from "@mui/icons-material/Note";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import AddIcon from "@mui/icons-material/Add";
import { useSession } from "next-auth/react";

interface AddToProjectModalProps {
  open: boolean;
  onClose: () => void;
  postId: number;
  onAddToProject: (projectId: number) => void;
  onCreateAndAdd: (projectName: string) => void;
  onSaveWithoutProject: () => void;
}

const AddToProjectModal: React.FC<AddToProjectModalProps> = ({
  open,
  onClose,
  postId,
  onAddToProject,
  onCreateAndAdd,
  onSaveWithoutProject,
}) => {
  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";
  const [newProjectName, setNewProjectName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Fetch categories
  useEffect(() => {
    console.log("AddToProjectModal useEffect:", { open, userId, postId });
    const fetchCategories = async () => {
      if (!open || !userId) return;
      console.log("Fetching categories for modal");
      setCategoriesLoading(true);
      try {
        const response = await fetch(`/api/saved-categories?userId=${userId}`);
        const data = await response.json();
        setCategories(data.categories || []);
        console.log("Categories fetched:", data.categories);
      } catch (error) {
        console.error("Error fetching categories:", error);
        setError("Failed to load projects");
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, [open, userId, postId]);

  const handleAddToExistingProject = async (projectId: number) => {
    setLoading(true);
    setError("");
    try {
      await onAddToProject(projectId);
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
    setLoading(true);
    setError("");
    try {
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
      await onSaveWithoutProject();
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

  if (showCreateForm) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            error={!!error}
            helperText={error}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateAndAdd}
            variant="contained"
            disabled={loading || !newProjectName.trim()}
          >
            {loading ? "Creating..." : "Create & Add"}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  console.log("AddToProjectModal render:", {
    open,
    categoriesLoading,
    categories,
  });
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Add to Project</DialogTitle>
      <DialogContent>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {categoriesLoading ? (
          <Typography>Loading projects...</Typography>
        ) : (
          <>
            {/* Existing Projects */}
            {categories.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Add to Existing Project
                </Typography>
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
                        cursor: "pointer",
                        transition: "all 0.2s",
                        "&:hover": {
                          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                          transform: "translateY(-2px)",
                        },
                      }}
                      onClick={() => handleAddToExistingProject(project.id)}
                    >
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {project.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Click to add to this project
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </Box>
            )}

            {/* Save without project option */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Quick Save
              </Typography>
              <Card
                sx={{
                  cursor: "pointer",
                  transition: "all 0.2s",
                  "&:hover": {
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    transform: "translateY(-2px)",
                  },
                }}
                onClick={handleSaveWithoutProject}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Save without project
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Save this post to your bookmarks without adding to a project
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={() => setShowCreateForm(true)}
          variant="contained"
          startIcon={<AddIcon />}
          disabled={loading}
        >
          Create New Project
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddToProjectModal;

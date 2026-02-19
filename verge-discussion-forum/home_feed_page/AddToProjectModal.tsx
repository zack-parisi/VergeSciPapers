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
import NoteIcon from "@mui/icons-material/Note";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import IconButton from "@mui/material/IconButton";
import { useSession } from "next-auth/react";

import ProjectNoteModal from "../app/saved/ProjectNoteModal";
import IndividualPostNoteModal from "../app/saved/IndividualPostNoteModal";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

interface AddToProjectModalProps {
  open: boolean;
  onClose: () => void;
  staffPostId?: number; // Make optional for MongoDB papers
  targetId?: string; // NEW: For MongoDB papers and other content types
  targetType?:
    | "staff_post"
    | "mongodb_paper"
    | "repost"
    | "post"
    | "eureka_response"
    | "eureka_result"; // NEW: Support mongodb_paper and eureka_response/eureka_result
  completePaperData?: any; // NEW: Complete paper data for fast bookmarking
  onAddToProject: (projectId: number) => void;
  onCreateAndAdd: (projectName: string) => void;
  onSaveWithoutProject: () => void;
  postId?: string; // NEW: Post ID for reposts and regular posts
}

const AddToProjectModal: React.FC<AddToProjectModalProps> = ({
  open,
  onClose,
  staffPostId,
  targetId, // NEW: For MongoDB papers
  targetType = "staff_post", // NEW: Default to staff_post
  completePaperData, // NEW: Complete paper data
  onAddToProject,
  onCreateAndAdd,
  onSaveWithoutProject,
  postId, // NEW: Post ID for reposts
}) => {
  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [newProjectName, setNewProjectName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projectNotes, setProjectNotes] = useState<{ [key: number]: string }>(
    {}
  );
  const [individualPostNotes, setIndividualPostNotes] = useState<{
    [key: number]: Array<{
      type: string;
      contentId: number;
      content: string;
      title?: string;
    }>;
  }>({});
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [selectedProjectForNote, setSelectedProjectForNote] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [currentPostHasNote, setCurrentPostHasNote] = useState(false);
  const [individualNoteModalOpen, setIndividualNoteModalOpen] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Determine the correct ID to use based on target type
  const contentId =
    targetType === "mongodb_paper" ||
    targetType === "eureka_response" ||
    targetType === "eureka_result"
      ? targetId
      : staffPostId?.toString();
  const numericContentId = targetType === "staff_post" ? staffPostId : null;

  // Fetch categories using MongoDB API
  const fetchCategories = async () => {
    if (!userId) return;
    setCategoriesLoading(true);
    try {
      const response = await fetch(
        `/api/saved-categories/mongodb?userId=${userId}`
      );
      const data = await response.json();
      if (data.categories) {
        setCategories(data.categories);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch categories if modal is open and we don't already have them
    if (open && userId && categories.length === 0) {
      fetchCategories();
    }
  }, [open, userId, categories.length]);

  // Check if current post has notes (using MongoDB API)
  useEffect(() => {
    const checkCurrentPostNote = async () => {
      if (!contentId || !userId) return;

      try {
        // For now, we'll skip note checking since the MongoDB note system isn't implemented yet
        // This can be updated when we implement the MongoDB notes API
        setCurrentPostHasNote(false);
      } catch (error) {
        console.error("Error checking current post note:", error);
        setCurrentPostHasNote(false);
      }
    };

    if (open) {
      checkCurrentPostNote();
    }
  }, [open, staffPostId, userId]);

  // Fetch notes for all projects
  useEffect(() => {
    const fetchProjectNotes = async () => {
      if (!categories.length) return;

      const notes: { [key: number]: string } = {};
      const individualNotes: {
        [key: number]: Array<{
          type: string;
          contentId: number;
          content: string;
          title?: string;
        }>;
      } = {};

      for (const project of categories) {
        try {
          // Fetch project note
          const projectResponse = await fetch(
            `/api/saved-categories/${project.id}/note`
          );
          const projectData = await projectResponse.json();
          if (projectData.note) {
            notes[project.id] = projectData.note.content;
          }

          // Fetch individual post notes for this project
          const individualResponse = await fetch(
            `/api/saved-notes?userId=${userId}`
          );
          const individualData = await individualResponse.json();

          const projectIndividualNotes: Array<{
            type: string;
            contentId: number;
            content: string;
            title?: string;
          }> = [];

          // Check if any of the individual notes belong to content in this project
          if (individualData.postNotes) {
            for (const note of individualData.postNotes) {
              // Check if this post is in the current project
              const isInProject = project.posts?.some(
                (p: any) => p.postId === note.postId
              );
              if (isInProject) {
                projectIndividualNotes.push({
                  type: "post",
                  contentId: note.postId,
                  content: note.content,
                  title: note.post?.content?.substring(0, 50) + "..." || "Post",
                });
              }
            }
          }

          if (individualData.staffPostNotes) {
            for (const note of individualData.staffPostNotes) {
              // Check if this staff post is in the current project
              const isInProject = project.staffPosts?.some(
                (s: any) => s.staffPostId === note.staffPostId
              );
              if (isInProject) {
                projectIndividualNotes.push({
                  type: "staffPost",
                  contentId: note.staffPostId,
                  content: note.content,
                  title: note.staffPost?.title || "Staff Post",
                });
              }
            }
          }

          if (individualData.grantNotes) {
            for (const note of individualData.grantNotes) {
              // Check if this grant is in the current project
              const isInProject = project.grants?.some(
                (g: any) => g.grantId === note.grantId
              );
              if (isInProject) {
                projectIndividualNotes.push({
                  type: "grant",
                  contentId: note.grantId,
                  content: note.content,
                  title: note.grant?.title || "Grant",
                });
              }
            }
          }

          if (projectIndividualNotes.length > 0) {
            individualNotes[project.id] = projectIndividualNotes;
          }
        } catch (error) {
          console.error("Error fetching notes for project:", project.id, error);
        }
      }
      setProjectNotes(notes);
      setIndividualPostNotes(individualNotes);
    };

    if (categories.length > 0) {
      fetchProjectNotes();
    }
  }, [categories, userId]);

  const handleAddToExistingProject = async (projectId: number) => {
    setLoading(true);
    setError("");
    try {
      console.log(" Adding to project:", {
        projectId,
        staffPostId,
        hasCompleteData: !!completePaperData,
        completeDataKeys: completePaperData
          ? Object.keys(completePaperData)
          : null,
      });

      // Bookmark creation is now handled automatically by the saved categories API
      console.log(
        " Bookmark will be created automatically when added to project"
      );

      // Use MongoDB API to add to project
      const response = await fetch("/api/saved-categories/mongodb", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: projectId,
          targetId: contentId,
          targetType: targetType, // Use the passed targetType instead of hardcoding "staff_post"
          completeData: completePaperData,
          postId: postId, // Include postId for reposts
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add to project");
      }

      // Bookmark is created automatically when added to project
      console.log(" Post added to project successfully");

      onAddToProject(projectId);
      onClose();

      // Show notes modal after successfully adding to project
      setTimeout(() => {
        setIndividualNoteModalOpen(true);
      }, 100);
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
      console.log(" Creating new project:", newProjectName.trim());

      // Create new project using MongoDB API
      const createResponse = await fetch("/api/saved-categories/mongodb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName.trim(),
          userId: userId,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Failed to create project");
      }

      const createData = await createResponse.json();
      console.log(" Project created:", createData);

      if (createData.category && createData.category.id) {
        console.log(" Adding post to new project:", createData.category.id);

        // Bookmark creation is now handled automatically by the saved categories API
        console.log(
          " Bookmark will be created automatically when added to project"
        );

        // Add to the newly created project
        const addResponse = await fetch("/api/saved-categories/mongodb", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: createData.category.id,
            targetId: contentId,
            targetType: targetType,
            completeData: completePaperData,
          }),
        });

        if (!addResponse.ok) {
          const errorData = await addResponse.json();
          throw new Error(errorData.error || "Failed to add to project");
        }

        console.log(" Post added to project successfully");

        // Bookmark is created automatically when added to project
        console.log(" Post added to project successfully");

        // Call the callback with the project info and close modal
        onCreateAndAdd(createData.category.name);
        onClose();

        // Show notes modal after successfully creating and adding to project
        setTimeout(() => {
          setIndividualNoteModalOpen(true);
        }, 100);
      } else {
        throw new Error("Invalid response from project creation");
      }
    } catch (err: any) {
      console.error(" Error in handleCreateAndAdd:", err);
      setError(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWithoutProject = async () => {
    setLoading(true);
    setError("");
    try {
      const startTime = Date.now();

      // Create bookmark directly since this is not adding to a project
      const response = await fetch("/api/mongodb/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          targetId: contentId,
          targetType: targetType,
          completePaperData: completePaperData,
          postId,
        }),
      });

      const endTime = Date.now();
      console.log(` Modal bookmark saved in ${endTime - startTime}ms`);

      if (!response.ok && response.status !== 409) {
        throw new Error("Failed to save post");
      }

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

  const handleOpenNoteModal = (project: { id: number; name: string }) => {
    setSelectedProjectForNote(project);
    setNoteModalOpen(true);
  };

  const handleCloseNoteModal = () => {
    setNoteModalOpen(false);
    setSelectedProjectForNote(null);
  };

  const handleNoteUpdate = () => {
    // Re-fetch all notes (both project and individual post notes)
    const fetchAllNotes = async () => {
      if (!categories.length) return;

      const notes: { [key: number]: string } = {};
      const individualNotes: {
        [key: number]: Array<{
          type: string;
          contentId: number;
          content: string;
          title?: string;
        }>;
      } = {};

      for (const project of categories) {
        try {
          // Fetch project note
          const projectResponse = await fetch(
            `/api/saved-categories/${project.id}/note`
          );
          const projectData = await projectResponse.json();
          if (projectData.note) {
            notes[project.id] = projectData.note.content;
          }

          // Fetch individual post notes for this project
          const individualResponse = await fetch(
            `/api/saved-notes?userId=${userId}`
          );
          const individualData = await individualResponse.json();

          const projectIndividualNotes: Array<{
            type: string;
            contentId: number;
            content: string;
            title?: string;
          }> = [];

          // Check if any of the individual notes belong to content in this project
          if (individualData.postNotes) {
            for (const note of individualData.postNotes) {
              const isInProject = project.posts?.some(
                (p: any) => p.postId === note.postId
              );
              if (isInProject) {
                projectIndividualNotes.push({
                  type: "post",
                  contentId: note.postId,
                  content: note.content,
                  title: note.post?.content?.substring(0, 50) + "..." || "Post",
                });
              }
            }
          }

          if (individualData.staffPostNotes) {
            for (const note of individualData.staffPostNotes) {
              const isInProject = project.staffPosts?.some(
                (s: any) => s.staffPostId === note.staffPostId
              );
              if (isInProject) {
                projectIndividualNotes.push({
                  type: "staffPost",
                  contentId: note.staffPostId,
                  content: note.content,
                  title: note.staffPost?.title || "Staff Post",
                });
              }
            }
          }

          if (individualData.grantNotes) {
            for (const note of individualData.grantNotes) {
              const isInProject = project.grants?.some(
                (g: any) => g.grantId === note.grantId
              );
              if (isInProject) {
                projectIndividualNotes.push({
                  type: "grant",
                  contentId: note.grantId,
                  content: note.content,
                  title: note.grant?.title || "Grant",
                });
              }
            }
          }

          if (projectIndividualNotes.length > 0) {
            individualNotes[project.id] = projectIndividualNotes;
          }
        } catch (error) {
          console.error("Error fetching notes for project:", project.id, error);
        }
      }
      setProjectNotes(notes);
      setIndividualPostNotes(individualNotes);
    };

    // For now, skip note fetching since we're using MongoDB and the note system isn't implemented yet
    // This can be updated when we implement the MongoDB notes API
    console.log("Note update requested - MongoDB notes not yet implemented");
  };

  return (
    <>
      {/* Test div to see if component is rendering */}

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        disableScrollLock={false}
        disableEscapeKeyDown={false}
        sx={{
          zIndex: 9999,
          "& .MuiDialog-paper": {
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            zIndex: 10000,
            position: "relative",
          },
          "& .MuiBackdrop-root": {
            zIndex: 9998,
          },
          "& .MuiDialog-container": {
            zIndex: 9999,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#1976d2", pb: 1 }}>
          Save to Project
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ mb: 3, color: "#666" }}>
            Choose how you'd like to save this post. You can add it to an
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
            <Box
              onClick={loading ? undefined : handleSaveWithoutProject}
              sx={{
                cursor: loading ? "not-allowed" : "pointer",
                borderRadius: 2,
                border: "2px solid #e3f0fd",
                transition: "all 0.2s",
                "&:hover": {
                  borderColor: "#1976d2",
                  boxShadow: "0 4px 12px rgba(25, 118, 210, 0.15)",
                },
              }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: "2px solid #e3f0fd",
                  transition: "all 0.2s",
                  "&:hover": {
                    borderColor: "#1976d2",
                    boxShadow: "0 4px 12px rgba(25, 118, 210, 0.15)",
                  },
                }}
              >
                <CardContent sx={{ p: 2, textAlign: "center" }}>
                  <BookmarkIcon
                    sx={{ fontSize: 32, color: "#1976d2", mb: 1 }}
                  />
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, color: "#1976d2" }}
                  >
                    Save without Project
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#666", mt: 0.5 }}>
                    Save this post to your bookmarks without organizing it into
                    a project
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Mobile: Create New Project Button (Floating) */}
          {isMobile && (
            <Box sx={{ position: "relative", mb: 3 }}>
              {!showCreateForm ? (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setShowCreateForm(true)}
                  fullWidth
                  sx={{
                    borderRadius: 2,
                    py: 1.5,
                    fontWeight: 600,
                    textTransform: "none",
                    fontSize: "1rem",
                  }}
                >
                  Create New Project
                </Button>
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
                          flex: 1,
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
            </Box>
          )}

          {/* Desktop: Create New Project */}
          {!isMobile && (
            <>
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
            </>
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
                display: "flex",
                flexDirection: "column", // Always vertical
                gap: 2,
                overflowY: "auto",
                overflowX: "hidden",
                maxHeight: "60vh",
                pb: 1,
                "&::-webkit-scrollbar": {
                  width: 8,
                  backgroundColor: "#f1f1f1",
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "#c1c1c1",
                  borderRadius: 4,
                  "&:hover": {
                    backgroundColor: "#a8a8a8",
                  },
                },
              }}
            >
              {categories.map((project) => (
                <Box
                  key={project.id}
                  sx={{
                    width: "100%",
                    minWidth: "auto",
                    maxWidth: "100%",
                    flexShrink: 0,
                  }}
                >
                  <Box
                    onClick={
                      isMobile && !loading
                        ? () => handleAddToExistingProject(project.id)
                        : undefined
                    }
                    sx={{
                      cursor: isMobile && !loading ? "pointer" : "default",
                    }}
                  >
                    <Card
                      sx={{
                        borderRadius: isMobile ? 3 : 2,
                        border: "2px solid #e3f0fd",
                        transition: "all 0.2s",
                        height: "auto",
                        minHeight: isMobile ? 80 : "auto",
                        "&:hover": {
                          borderColor: "#1976d2",
                          boxShadow: "0 4px 12px rgba(25, 118, 210, 0.15)",
                        },
                      }}
                    >
                      <CardContent sx={{ p: isMobile ? 3 : 2 }}>
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: isMobile ? "column" : "row",
                            justifyContent: isMobile
                              ? "center"
                              : "space-between",
                            alignItems: isMobile ? "center" : "center",
                            mb: isMobile ? 0 : 2,
                            gap: isMobile ? 2 : 0,
                          }}
                        >
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 600,
                              color: "#1976d2",
                              flex: 1,
                              fontSize: isMobile ? "1.3rem" : "1.25rem",
                              lineHeight: isMobile ? 1.3 : 1.2,
                              textAlign: isMobile ? "center" : "left",
                            }}
                          >
                            {project.name}
                          </Typography>
                          {!isMobile && (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                alignSelf: "center",
                              }}
                            >
                              <IconButton
                                size="small"
                                onClick={() => handleOpenNoteModal(project)}
                                title={
                                  projectNotes[project.id]
                                    ? "View/Edit Project Notes"
                                    : "Add Project Notes"
                                }
                                sx={{
                                  color: projectNotes[project.id]
                                    ? "#1976d2"
                                    : "#666",
                                  bgcolor: projectNotes[project.id]
                                    ? "rgba(25, 118, 210, 0.1)"
                                    : "transparent",
                                  borderRadius: "50%",
                                  width: 28,
                                  height: 28,
                                  minWidth: 28,
                                  minHeight: 28,
                                  boxShadow: projectNotes[project.id]
                                    ? "0 2px 8px rgba(25, 118, 210, 0.15)"
                                    : "none",
                                  transition: "all 0.2s",
                                  "&:hover": {
                                    color: currentPostHasNote
                                      ? "#333"
                                      : "#1976d2",
                                    bgcolor: currentPostHasNote
                                      ? "rgba(102, 102, 102, 0.15)"
                                      : "rgba(25, 118, 210, 0.08)",
                                    boxShadow: currentPostHasNote
                                      ? "0 4px 12px rgba(102, 102, 102, 0.2)"
                                      : "0 4px 12px rgba(25, 118, 210, 0.2)",
                                  },
                                }}
                              >
                                {currentPostHasNote ? (
                                  <NoteIcon fontSize="small" />
                                ) : (
                                  <NoteAddIcon fontSize="small" />
                                )}
                              </IconButton>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() =>
                                  handleAddToExistingProject(project.id)
                                }
                                disabled={loading}
                                sx={{
                                  borderRadius: 2,
                                  textTransform: "none",
                                  fontWeight: 600,
                                  fontSize: "0.875rem",
                                  px: 2,
                                  py: 0.75,
                                }}
                              >
                                Add
                              </Button>
                            </Box>
                          )}

                          {/* Mobile: Note button below project name */}
                          {isMobile && (
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "center",
                                mt: 2,
                              }}
                            >
                              <IconButton
                                size="small"
                                onClick={() => handleOpenNoteModal(project)}
                                title={
                                  projectNotes[project.id]
                                    ? "View/Edit Project Notes"
                                    : "Add Project Notes"
                                }
                                sx={{
                                  color: projectNotes[project.id]
                                    ? "#1976d2"
                                    : "#666",
                                  bgcolor: projectNotes[project.id]
                                    ? "rgba(25, 118, 210, 0.1)"
                                    : "transparent",
                                  borderRadius: "50%",
                                  width: 32,
                                  height: 32,
                                  minWidth: 32,
                                  minHeight: 32,
                                  boxShadow: projectNotes[project.id]
                                    ? "0 2px 8px rgba(25, 118, 210, 0.15)"
                                    : "none",
                                  transition: "all 0.2s",
                                  "&:hover": {
                                    color: currentPostHasNote
                                      ? "#333"
                                      : "#1976d2",
                                    bgcolor: currentPostHasNote
                                      ? "rgba(102, 102, 102, 0.15)"
                                      : "rgba(25, 118, 210, 0.08)",
                                    boxShadow: currentPostHasNote
                                      ? "0 4px 12px rgba(102, 102, 102, 0.2)"
                                      : "0 4px 12px rgba(25, 118, 210, 0.2)",
                                  },
                                }}
                              >
                                {currentPostHasNote ? (
                                  <NoteIcon fontSize="small" />
                                ) : (
                                  <NoteAddIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Box>
                          )}
                        </Box>

                        {/* Note Preview */}
                        {projectNotes[project.id] && !isMobile && (
                          <Box sx={{ mt: 2 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "#666",
                                fontStyle: "italic",
                                fontSize: "0.875rem",
                                lineHeight: 1.3,
                                maxHeight: 40,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                bgcolor: "#f8f9fa",
                                p: 1,
                                borderRadius: 1,
                                border: "1px solid #e9ecef",
                              }}
                            >
                              "{projectNotes[project.id].substring(0, 80)}..."
                            </Typography>
                          </Box>
                        )}

                        {/* Individual Post Notes Preview */}
                        {individualPostNotes[project.id] &&
                          individualPostNotes[project.id].length > 0 &&
                          !isMobile && (
                            <Box sx={{ mt: 2 }}>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "#666",
                                  fontWeight: 600,
                                  display: "block",
                                  mb: 1,
                                }}
                              >
                                Individual Post Notes (
                                {individualPostNotes[project.id].length})
                              </Typography>
                              {individualPostNotes[project.id]
                                .slice(0, 2)
                                .map((note, index) => (
                                  <Box key={index} sx={{ mb: 1 }}>
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
                                        color: "#666",
                                        fontSize: "0.75rem",
                                        lineHeight: 1.3,
                                        maxHeight: 30,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        bgcolor: "#f0f4f8",
                                        p: 0.5,
                                        borderRadius: 0.5,
                                        border: "1px solid #e3e8ed",
                                      }}
                                    >
                                      "{note.content.substring(0, 60)}..."
                                    </Typography>
                                  </Box>
                                ))}
                              {individualPostNotes[project.id].length > 2 && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "#666",
                                    fontStyle: "italic",
                                  }}
                                >
                                  +{individualPostNotes[project.id].length - 2}{" "}
                                  more notes
                                </Typography>
                              )}
                            </Box>
                          )}
                      </CardContent>
                    </Card>
                  </Box>
                </Box>
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

      {/* Project Note Modal */}
      {selectedProjectForNote && (
        <ProjectNoteModal
          open={noteModalOpen}
          onClose={handleCloseNoteModal}
          categoryId={selectedProjectForNote.id}
          categoryName={selectedProjectForNote.name}
          onNoteUpdate={handleNoteUpdate}
        />
      )}

      {/* Individual Post Note Modal */}
      <IndividualPostNoteModal
        open={individualNoteModalOpen}
        onClose={() => setIndividualNoteModalOpen(false)}
        type="staffPost"
        contentId={numericContentId || contentId || 0}
        contentTitle={completePaperData?.title || "Staff Post"}
        onNoteUpdate={() => {
          setIndividualNoteModalOpen(false);
          // Refresh the current post note status
          setCurrentPostHasNote(true);
        }}
      />
      {(() => {
        console.log(
          " AddToProjectModal - staffPostId for notes:",
          staffPostId
        );
        return null;
      })()}
    </>
  );
};

export default AddToProjectModal;

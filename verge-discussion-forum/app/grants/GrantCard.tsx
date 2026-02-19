import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  Button,
  IconButton,
  Avatar,
  Divider,
  Link,
} from "@mui/material";
import {
  ThumbUp,
  ThumbUpOutlined,
  Bookmark,
  BookmarkBorder,
  Comment,
  Launch,
} from "@mui/icons-material";
import {
  Grant,
  likeGrant,
  unlikeGrant,
  bookmarkGrant,
  unbookmarkGrant,
  getGrantLikeStatus,
  isGrantBookmarked,
} from "./grantApi";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import CircularProgress from "@mui/material/CircularProgress";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import GrantAddToProjectModal from "./GrantAddToProjectModal";

interface GrantCardProps {
  grant: Grant;
  onComment?: (grantId: string) => void;
  onOpenForum?: (grantId: string) => void;
  index?: number;
  onUnbookmark?: (grantId: string) => void;
  headerIcons?: React.ReactNode;
  initialBookmarked?: boolean;
}

export default function GrantCard({
  grant,
  onComment,
  onOpenForum,
  index,
  onUnbookmark,
  headerIcons,
  initialBookmarked,
}: GrantCardProps) {
  const { data: session, status } = useSession();
  const userId = session?.userId; // Remove the fallback to test-user-1
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });

  // Helper to require authentication for actions
  const requireAuth = (action: () => void) => {
    if (status !== "authenticated") {
      router.push("/login");
      return;
    }
    action();
  };

  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(initialBookmarked || false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [addToProjectModalOpen, setAddToProjectModalOpen] = useState(false);
  const [savedInProjects, setSavedInProjects] = useState<any[]>([]);

  // Fetch like count and user-like status on mount/user/grant change
  useEffect(() => {
    if (!userId || !grant?.id) return;
    fetch(`/api/grants/like?grantId=${grant.id}&userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        setLikeCount(data.likeCount || 0);
        setLiked(!!data.liked);
      });
  }, [userId, grant?.id]);

  // Load bookmark status only if we don't have an initial state
  useEffect(() => {
    if (!userId || !grant?.id || initialBookmarked !== undefined) return;
    isGrantBookmarked(grant.id, userId).then(setBookmarked);
  }, [userId, grant?.id, initialBookmarked]);

  const handleLike = async () => {
    requireAuth(async () => {
      if (!userId || !grant?.id) return;
      if (!liked) {
        // Like
        setLiked(true);
        setLikeCount((c: number) => c + 1);
        const res = await fetch("/api/grants/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, grantId: grant.id }),
        });
        if (res.status === 409) {
          // Already liked, ignore
          setLiked(true);
        }
      } else {
        // Unlike
        setLiked(false);
        setLikeCount((c: number) => Math.max(0, c - 1));
        const res = await fetch("/api/grants/like", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, grantId: grant.id }),
        });
        if (res.status === 404) {
          setLiked(false);
        }
      }
    });
  };

  const handleBookmark = async () => {
    requireAuth(async () => {
      if (loading) return;

      if (!bookmarked) {
        // If NOT bookmarked, show the modal to save the grant
        setAddToProjectModalOpen(true);
      } else {
        // If already bookmarked, unbookmark directly
        setLoading(true);
        try {
          // Remove from all projects first
          const projectResponse = await fetch(
            `/api/saved-categories?userId=${userId}&grantId=${grant.id}`
          );
          const projectData = await projectResponse.json();

          if (projectData.isSaved && projectData.categories) {
            for (const project of projectData.categories) {
              await fetch("/api/saved-categories", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  categoryId: project.id,
                  grantId: grant.id,
                }),
              });
            }
          }

          // Then unbookmark from regular bookmarks
          if (userId) {
            await unbookmarkGrant(userId, grant.id);
          }
          setBookmarked(false);
          if (onUnbookmark) onUnbookmark(grant.id);
        } catch (error) {
          console.error("Failed to unbookmark:", error);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleAddToProject = async (projectId: string) => {
    if (!userId) return;

    try {
      // Add grant to the project using MongoDB API
      await fetch("/api/saved-categories/mongodb", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: projectId,
          targetId: grant.id,
          targetType: "grant",
          completeData: grant, // Pass the complete grant data
        }),
      });

      // Also bookmark the grant
      await bookmarkGrant(userId, grant.id);

      // This will be called when user adds to existing project
      setBookmarked(true);

      // Refresh the saved projects list
      const response = await fetch(
        `/api/saved-categories/mongodb?userId=${userId}`
      );
      const data = await response.json();
      if (data.categories) {
        // Find categories that contain this grant
        const grantCategories = data.categories.filter((cat: any) =>
          cat.grants?.some((g: any) => g.targetId === grant.id)
        );
        setSavedInProjects(grantCategories || []);
      }
    } catch (error) {
      console.error("Error adding grant to project:", error);
    }
  };

  const handleCreateAndAdd = async (projectName: string) => {
    if (!userId) return;

    try {
      // Create new category using MongoDB API
      const createResponse = await fetch("/api/saved-categories/mongodb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: projectName }),
      });
      const createData = await createResponse.json();

      if (createData.category) {
        // Add grant to the new category
        await fetch("/api/saved-categories/mongodb", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: createData.category.id,
            targetId: grant.id,
            targetType: "grant",
            completeData: grant, // Pass the complete grant data
          }),
        });
        setBookmarked(true);

        // Refresh the saved projects list
        const response = await fetch(
          `/api/saved-categories/mongodb?userId=${userId}`
        );
        const data = await response.json();
        if (data.categories) {
          // Find categories that contain this grant
          const grantCategories = data.categories.filter((cat: any) =>
            cat.grants?.some((g: any) => g.targetId === grant.id)
          );
          setSavedInProjects(grantCategories || []);
        }
      }
    } catch (error) {
      console.error("Error creating project and adding grant:", error);
    }
  };

  const handleSaveWithoutProject = async () => {
    if (!userId) return;

    // This will be called when user saves without adding to a project
    try {
      await bookmarkGrant(userId, grant.id);
      setBookmarked(true);
    } catch (error) {
      console.error("Error saving without project:", error);
    }
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Deadline passed (${Math.abs(diffDays)} days ago)`;
    } else if (diffDays === 0) {
      return "Deadline today";
    } else if (diffDays === 1) {
      return "Deadline tomorrow";
    } else if (diffDays <= 7) {
      return `Deadline in ${diffDays} days`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getDeadlineColor = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const daysUntilDeadline = Math.ceil(
      (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDeadline < 0) return "error";
    if (daysUntilDeadline <= 7) return "warning";
    if (daysUntilDeadline <= 30) return "info";
    return "default";
  };

  // Format funding amount for display
  const formatFundingAmount = (
    amount: string | number | null | undefined
  ): string => {
    if (
      !amount ||
      amount === "" ||
      amount === "Amount varies - please check opportunity details"
    ) {
      return "Amount Varies";
    }

    // Extract dollar amounts from the text description (same logic as filtering)
    if (typeof amount === "string") {
      const dollarMatches = amount.match(
        /\$[\d,]+(?:\.\d+)?\s*(?:million|billion)?/gi
      );
      if (dollarMatches && dollarMatches.length > 0) {
        // Convert all found amounts to numbers and take the highest one
        const amounts = dollarMatches
          .map((match: string) => {
            const cleanAmount = match.replace(/[$,]/g, "");
            let numAmount = Number(cleanAmount);

            // Handle million and billion suffixes
            if (match.toLowerCase().includes("million")) {
              numAmount = numAmount * 1000000;
            } else if (match.toLowerCase().includes("billion")) {
              numAmount = numAmount * 1000000000;
            }

            return numAmount;
          })
          .filter((num: number) => !isNaN(num));

        if (amounts.length > 0) {
          const maxAmount = Math.max(...amounts);
          return `$${maxAmount.toLocaleString()}`;
        }
      }
    }

    // Fallback: try to parse as a simple number
    const cleanAmount = String(amount).replace(/[$,]/g, "");
    const numAmount = parseFloat(cleanAmount);

    if (isNaN(numAmount)) {
      return "Amount Varies";
    }

    // Format with commas for thousands
    return `$${numAmount.toLocaleString()}`;
  };

  return (
    <>
      <Card
        id={`grant-${index}`}
        sx={{
          mb: 2,
          borderRadius: 2,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          "&:hover": {
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          },
          transition: "box-shadow 0.2s ease-in-out",
          width: isMobile ? "100vw" : "100%",
          maxWidth: isMobile ? "100vw" : 800,
          mx: isMobile ? 0 : "auto",
        }}
      >
        <CardContent sx={{ pb: 1 }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Avatar
              sx={{
                mr: 2,
                width: 56,
                height: 56,
                border: "2px solid #fff",
                bgcolor: "transparent",
              }}
            >
              <img
                src="/vergesci_logo.jpeg"
                alt="VergeSci Logo"
                width={48}
                height={48}
                style={{ borderRadius: 24 }}
              />
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, fontSize: 18, color: "#1976d2" }}
                style={{ color: "#000" }}
              >
                VergeSci
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(grant.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
            {headerIcons && (
              <Box sx={{ display: "flex", gap: 1, ml: 2 }}>{headerIcons}</Box>
            )}
          </Box>

          {/* Title */}
          <Typography
            variant="h6"
            sx={{ mb: 1, fontWeight: 600, color: "#1976d2" }}
          >
            {grant.title}
          </Typography>

          {/* Agency and Type */}
          <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
            <Chip
              label={grant.agency}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={grant.type}
              size="small"
              color="secondary"
              variant="outlined"
            />
          </Box>

          {/* Amount */}
          <Box sx={{ mb: 2 }}>
            <Chip
              label={formatFundingAmount(grant.amount)}
              size="small"
              color="success"
              variant="outlined"
            />
          </Box>

          {/* Dates */}
          {grant.dates && (
            <Box sx={{ mb: 2 }}>
              <Chip
                label={grant.dates}
                size="small"
                color="info"
                variant="filled"
              />
            </Box>
          )}

          {/* Description */}
          <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
            {grant.description}
          </Typography>

          {/* Eligibility */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Eligibility:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {grant.eligibility}
            </Typography>
          </Box>

          {/* Grant Website Link */}
          <Box sx={{ mb: 2 }}>
            <Button
              component="a"
              href={grant.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
              sx={{
                borderRadius: 999,
                px: 1.5,
                py: 0.25,
                fontWeight: 600,
                fontSize: 12,
                minHeight: 28,
                minWidth: 0,
                boxShadow: 0,
                textTransform: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                bgcolor: "#1976d2",
                color: "#fff",
                "&:hover": {
                  bgcolor: "#1251a3",
                  color: "#fff",
                },
              }}
              startIcon={<Launch sx={{ fontSize: 15, color: "#fff" }} />}
            >
              View Grant Details
            </Button>
          </Box>
        </CardContent>

        <Divider />

        {/* Actions */}
        <CardActions sx={{ px: 2, py: 1 }}>
          <IconButton
            onClick={handleLike}
            disabled={loading || status === "loading"}
            sx={{ color: liked ? "#1976d2" : "inherit" }}
          >
            {loading || status === "loading" ? (
              <CircularProgress size={22} />
            ) : liked ? (
              <ThumbUp />
            ) : (
              <ThumbUpOutlined />
            )}
          </IconButton>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {likeCount}
          </Typography>

          <IconButton
            onClick={handleBookmark}
            disabled={loading}
            sx={{ color: bookmarked ? "#1976d2" : "inherit" }}
          >
            {bookmarked ? <Bookmark /> : <BookmarkBorder />}
          </IconButton>

          <Box sx={{ flex: 1 }} />

          {onComment && !isMobile && (
            <Button
              startIcon={<Comment />}
              onClick={() => requireAuth(() => onComment(grant.id))}
              size="small"
              sx={{ mr: 1 }}
            >
              Comment
            </Button>
          )}

          {onOpenForum && (
            <Button
              variant="outlined"
              onClick={() => requireAuth(() => onOpenForum(grant.id))}
              size="small"
            >
              Open Forum
            </Button>
          )}
        </CardActions>
      </Card>

      {/* Add to Project Modal */}
      <GrantAddToProjectModal
        open={addToProjectModalOpen}
        onClose={() => setAddToProjectModalOpen(false)}
        grantId={grant.id}
        onAddToProject={handleAddToProject}
        onCreateAndAdd={handleCreateAndAdd}
        onSaveWithoutProject={handleSaveWithoutProject}
      />
    </>
  );
}

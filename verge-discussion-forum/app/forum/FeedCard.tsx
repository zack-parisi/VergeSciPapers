import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Avatar from "@mui/material/Avatar";
import PersonIcon from "@mui/icons-material/Person";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import CommentIcon from "@mui/icons-material/Comment";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { useRouter } from "next/navigation";
import StaffPostCard from "../../home_feed_page/StaffPostCard";
import EurekaRepostCard from "../eureka/EurekaRepostCard";
import UserLink from "../components/UserLink";
import { useSession } from "next-auth/react";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ForumIcon from "@mui/icons-material/Forum";
import Linkify from "linkify-react";
import ForumFeedAddToProjectModal from "./ForumFeedAddToProjectModal";
import { useLikes } from "../../hooks/useLikes";
import { useBookmarks } from "../../hooks/useBookmarks";
import { useBookmarksWithConfirmation } from "../../hooks/useBookmarksWithConfirmation";
import AddToProjectModal from "../../home_feed_page/AddToProjectModal";

// Props: post (regular post or repost), userId, menu handlers (optional), showMenu (optional), onComment (optional)
export default function FeedCard({
  post,
  userId,
  menuAnchorEl,
  openMenu,
  menuPostId,
  handleMenuClick,
  handleMenuClose,
  handleEdit,
  handleDelete,
  onComment,
  onOpenForum,
  showMenu = false,
  inForumPage = false,
  removeButton,
  bookmarked: bookmarkedProp, // NEW
  inBucket = false, // NEW
  compact = false, // NEW
  onUnbookmark, // NEW
  headerIcons,
  onBookmarkClick, // NEW
}: any) {
  const router = useRouter();
  const { status } = useSession();
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

  // Helper for user profile click
  const handleUserProfileClick = (userId: string) => {
    requireAuth(() => {
      router.push(`/profile/${userId}`);
    });
  };

  // Fetch user data if not available
  const fetchUserData = async (userId: string) => {
    if (!userId || userData) return;

    try {
      const response = await fetch(`/api/profile/mongodb/${userId}`);
      if (response.ok) {
        const user = await response.json();
        setUserData(user);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  // Use the new likes hook for reposts
  const repostId = post.type === "repost" ? post.postId : null;
  const {
    likeCount,
    liked,
    loading: likeLoading,
    handleLikeClick,
  } = useLikes({
    targetId: repostId || "",
    targetType: "repost",
    initialLikeCount: 0,
    initialLiked: false,
  });

  // Determine the correct target ID and type for bookmarks
  const getBookmarkTarget = () => {
    if (post.type === "repost") {
      // For reposts, use the targetId if available, otherwise fall back to postId
      const targetId =
        post.targetId || post.postId?.toString() || post.id?.toString() || "";
      return {
        targetId,
        targetType: "repost" as const,
        postId: post.postId?.toString() || post.id?.toString(), // Include the actual repost ID
      };
    } else if (post.type === "post") {
      return {
        targetId: post.id?.toString() || "",
        targetType: "post" as const,
        postId: post.id?.toString(), // For regular posts, postId is the same as targetId
      };
    } else {
      // Default to post type
      return {
        targetId: post.id?.toString() || "",
        targetType: "post" as const,
        postId: post.id?.toString(),
      };
    }
  };

  const { targetId, targetType, postId } = getBookmarkTarget();

  // Use the new bookmarks hook with confirmation for all content types
  const {
    bookmarkCount,
    bookmarked,
    loading: bookmarkLoading,
    handleBookmarkClick,
  } = useBookmarksWithConfirmation({
    targetId,
    targetType,
    initialBookmarkCount: 0,
    initialBookmarked: !!bookmarkedProp,
    onBookmarkClick: () => {
      setAddToProjectModalOpen(true);
      setModalKey((prev) => prev + 1);
    },
    postId, // NEW: Pass the post ID for reposts
    itemTitle:
      post?.title || post?.content?.substring(0, 50) + "..." || "Unknown Post",
    itemType: targetType === "repost" ? "forum" : "post",
  });

  // Use the hook if we have a valid target ID
  const shouldUseBookmarksHook = !!targetId;
  const [staffPostLiked, setStaffPostLiked] = useState(false);
  const [staffPostLikeCount, setStaffPostLikeCount] = useState(0);
  const [addToProjectModalOpen, setAddToProjectModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  useEffect(() => {
    if (post.type === "repost" && post.staffPost?.id && userId) {
      // Like state
      fetch(
        `/api/staff-posts/like/mongodb?staffPostId=${post.staffPost.id}&userId=${userId}`
      )
        .then((res) => res.json())
        .then((data) => {
          setStaffPostLikeCount(data.likeCount || 0);
          setStaffPostLiked(!!data.liked);
        });
    }
  }, [post.type, post.staffPost?.id, userId]);

  // Handle click on embedded staff post
  const handleStaffPostClick = () => {
    if (post.type === "repost" && post.staffPost?.id) {
      // Navigate to home page with the correct postId parameter
      // For MongoDB papers, use the linkId (OpenAlex URL), for staff posts use the id
      const postId = post.staffPost.linkId || post.staffPost.id.toString();
      console.log(" Navigating to home with postId:", postId);
      router.push(`/home?postId=${encodeURIComponent(postId)}`);
    }
  };

  // Fetch user data if not available (for reposts)
  useEffect(() => {
    if (
      post.type === "repost" &&
      post.userId &&
      !post.user &&
      !post.userFullName
    ) {
      fetchUserData(post.userId);
    }
  }, [post.type, post.userId, post.user, post.userFullName, fetchUserData]);

  if (post.type === "repost") {
    // Debug logging for repost content
    console.log(" FeedCard repost debug:", {
      postId: post.id,
      hasContent: !!post.content,
      content: post.content,
      contentType: typeof post.content,
      contentLength: post.content?.length || 0,
      userFullName: post.userFullName,
      hasUser: !!post.user,
      hasStaffPost: !!post.staffPost,
      staffPost: post.staffPost,
      staffPostId: post.staffPostId,
      targetType: post.targetType,
      hasEurekaData: !!post.eurekaData,
      eurekaData: post.eurekaData,
      postKeys: Object.keys(post),
    });

    // Filter out reposts with null postId only (temporarily allow "User" names)
    if (!post.postId) {
      console.log(" Filtering out problematic repost:", {
        postId: post.id,
        content: post.content,
        userFullName: post.userFullName,
        hasStaffPost: !!post.staffPost,
      });
      return null;
    }

    // Prefer firstName/lastName from post.user if available, then userData, then userFullName, then userId
    const displayName =
      post.user && (post.user.firstName || post.user.lastName)
        ? `${post.user.firstName || ""} ${post.user.lastName || ""}`.trim()
        : userData && (userData.firstName || userData.lastName)
          ? `${userData.firstName || ""} ${userData.lastName || ""}`.trim()
          : post.userFullName || post.userId;
    const avatarLetter =
      post.user && post.user.firstName
        ? post.user.firstName[0].toUpperCase()
        : userData && userData.firstName
          ? userData.firstName[0].toUpperCase()
          : post.userFullName
            ? post.userFullName[0].toUpperCase()
            : post.userId
              ? post.userId[0].toUpperCase()
              : "?";
    return (
      <Box
        key={`feedcard-${modalKey}`}
        sx={{
          width: isMobile ? "100vw" : "100%",
          overflow: "visible",
          mx: undefined,
        }}
      >
        <Card
          key={post.id}
          sx={
            isMobile
              ? {
                  borderRadius: 2,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  transition: "box-shadow 0.2s ease-in-out",
                  mb: 1,
                  width: "100vw",
                  maxWidth: "100vw",
                  minWidth: 0,
                  mx: undefined,
                  height: "auto",
                  "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.15)" },
                }
              : compact
                ? {
                    borderRadius: 2,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "box-shadow 0.2s ease-in-out",
                    mb: 2,
                    width: "100%",
                    maxWidth: "100%",
                    minWidth: 0,
                    position: "relative",
                    mx: "auto",
                    height: "auto",
                    "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.15)" },
                  }
                : {
                    borderRadius: 2,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    transition: "box-shadow 0.2s ease-in-out",
                    mb: 2,
                    width: "100%",
                    maxWidth: 2600,
                    minWidth: 1000,
                    position: "relative",
                    mx: "auto",
                    height: "auto",
                    "&:hover": { boxShadow: "0 4px 16px rgba(0,0,0,0.15)" },
                  }
          }
        >
          {removeButton && (
            <Box sx={{ position: "absolute", top: 0, right: 0, zIndex: 10 }}>
              {removeButton}
            </Box>
          )}
          {showMenu && (
            <IconButton
              sx={{ position: "absolute", top: 10, right: 10, zIndex: 3 }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // For reposts, use postId; for regular posts, use id
                const id =
                  post.type === "repost"
                    ? post.postId
                    : post.post?.id || post.id;

                // If menu is already open for this post, close it
                if (openMenu && menuPostId === id) {
                  handleMenuClose();
                } else {
                  // Otherwise open the menu
                  if (id && handleMenuClick) handleMenuClick(e, id);
                }
              }}
            >
              <MoreVertIcon />
            </IconButton>
          )}
          {showMenu &&
            openMenu &&
            menuPostId ===
              (post.type === "repost"
                ? post.postId
                : post.post?.id || post.id) && (
              <Box
                sx={{
                  position: "absolute",
                  top: 42, // Just below the three-dot icon
                  right: 10,
                  zIndex: 9999,
                  backgroundColor: "white",
                  borderRadius: 1,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  minWidth: 120,
                }}
              >
                <MenuItem onClick={() => handleEdit && handleEdit(post)}>
                  Edit
                </MenuItem>
                <MenuItem
                  onClick={() =>
                    handleDelete &&
                    handleDelete(
                      post.type === "repost"
                        ? post.postId
                        : post.post?.id || post.id,
                      post.type
                    )
                  }
                >
                  Delete
                </MenuItem>
              </Box>
            )}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              mb: isMobile ? 0.5 : 1,
              px: isMobile ? 1 : 4,
              pt: isMobile ? 1 : 3,
            }}
          >
            <span
              onClick={() => handleUserProfileClick(post.userId)}
              style={{ cursor: "pointer" }}
            >
              <Avatar
                sx={{
                  mr: isMobile ? 1 : 2,
                  bgcolor: "#1976d2",
                  width: isMobile ? 28 : 40,
                  height: isMobile ? 28 : 40,
                }}
              >
                {avatarLetter}
              </Avatar>
            </span>
            <Box sx={{ flex: 1 }}>
              <span
                onClick={() => handleUserProfileClick(post.userId)}
                style={{ cursor: "pointer" }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, fontSize: isMobile ? 13 : undefined }}
                >
                  {displayName}
                </Typography>
              </span>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: isMobile ? 11 : undefined }}
              >
                {post.updatedAt && post.updatedAt !== post.createdAt
                  ? `Edited ${new Date(post.updatedAt).toLocaleDateString()}`
                  : post.createdAt
                    ? new Date(post.createdAt).toLocaleDateString()
                    : ""}
              </Typography>
            </Box>
            {headerIcons && (
              <Box sx={{ display: "flex", gap: 1, ml: 2 }}>{headerIcons}</Box>
            )}
          </Box>

          {/* User's comment (if any) */}
          {post.content && (
            <>
              {console.log(" Rendering repost content:", post.content)}
              <Typography
                variant="body1"
                sx={{
                  mb: isMobile ? 1 : 2,
                  lineHeight: 1.6,
                  color: "#333",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                  whiteSpace: "pre-wrap",
                  px: isMobile ? 1 : 4,
                  fontSize: isMobile ? 12.5 : undefined,
                }}
              >
                {post.content}
              </Typography>
            </>
          )}

          {/* Embedded Eureka repost */}
          {post.targetType === "eureka_result" && post.eurekaData && (
            <Box
              sx={{
                mt: isMobile ? 1 : 2,
                mb: isMobile ? 1 : 2,
                width: "100%",
                maxWidth: "100%",
                borderRadius: 3,
                zIndex: 1,
                boxSizing: "border-box",
                display: "flex",
                justifyContent: "center",
                px: isMobile ? 1 : 4,
              }}
            >
              <EurekaRepostCard eurekaData={post.eurekaData} compact />
            </Box>
          )}

          {/* Embedded staff post - now clickable */}
          {post.staffPost && post.targetType !== "eureka_result" && (
            <Box
              sx={{
                mt: isMobile ? 1 : 2,
                width: isMobile ? "100vw" : 950,
                maxWidth: isMobile ? "100vw" : "100%",
                borderRadius: 3,
                zIndex: 1,
                boxSizing: "border-box",
                cursor: "pointer",
                display: "flex",
                justifyContent: "center",
              }}
              onClick={() => {
                if (post.staffPost?.id) {
                  router.push(`/home?postId=${post.staffPost.id}`);
                }
              }}
            >
              <Box
                sx={{
                  p: 0,
                  bgcolor: "#ffffff",
                  borderRadius: 2,
                  border: "1.5px solid rgb(255, 255, 255)",
                  mb: 0,
                  width: isMobile ? "100vw" : undefined,
                  maxWidth: isMobile ? "100vw" : undefined,
                }}
              >
                <StaffPostCard
                  post={post.staffPost}
                  hideRepostButton={true}
                  showBookmark={false}
                  compact
                  liked={staffPostLiked}
                  likeCount={staffPostLikeCount}
                  onClick={handleStaffPostClick}
                />
              </Box>
            </Box>
          )}

          <Divider />

          {/* Actions */}
          <CardActions
            sx={{
              px: isMobile ? 1 : 4,
              py: isMobile ? 1 : 2,
              minHeight: isMobile ? 36 : 48,
            }}
          >
            <IconButton
              onClick={handleLikeClick}
              disabled={likeLoading}
              sx={{
                color: liked ? "#1976d2" : "inherit",
                fontSize: isMobile ? 18 : undefined,
              }}
            >
              {liked ? (
                <FavoriteIcon fontSize={isMobile ? "small" : undefined} />
              ) : (
                <FavoriteBorderIcon fontSize={isMobile ? "small" : undefined} />
              )}
            </IconButton>
            <Typography
              variant="body2"
              sx={{ mr: 2, fontSize: isMobile ? 12 : undefined }}
            >
              {likeCount}
            </Typography>
            <IconButton
              onClick={
                onUnbookmark ? () => onUnbookmark(post.id) : handleBookmarkClick
              }
              disabled={bookmarkLoading}
              sx={{
                color: bookmarked ? "#1976d2" : "inherit",
                fontSize: isMobile ? 18 : undefined,
              }}
            >
              {bookmarked ? (
                <BookmarkIcon fontSize={isMobile ? "small" : undefined} />
              ) : (
                <BookmarkBorderIcon fontSize={isMobile ? "small" : undefined} />
              )}
            </IconButton>

            <Box sx={{ flex: 1 }} />
            {onComment && (
              <IconButton
                onClick={() => {
                  requireAuth(() => {
                    onComment && onComment();
                  });
                }}
                size="small"
                sx={{ mr: 1, fontSize: isMobile ? 18 : undefined }}
              >
                <CommentIcon fontSize={isMobile ? "small" : undefined} />
              </IconButton>
            )}
            {onOpenForum && (
              <Button
                variant="outlined"
                onClick={() => requireAuth(() => onOpenForum && onOpenForum())}
                size="small"
                sx={{
                  fontSize: isMobile ? 11 : undefined,
                  px: isMobile ? 1 : undefined,
                  py: isMobile ? 0.5 : undefined,
                }}
              >
                Open Forum
              </Button>
            )}
          </CardActions>
        </Card>

        {/* Add to Project Modal for Regular Posts */}
        <ForumFeedAddToProjectModal
          open={addToProjectModalOpen}
          onClose={() => setAddToProjectModalOpen(false)}
          postId={post.id || parseInt(targetId) || 0}
          onAddToProject={async (projectId) => {
            console.log("Adding post to project:", projectId);
            try {
              // Use the useSavedCategories approach for adding to project
              const response = await fetch("/api/saved-categories/mongodb", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  categoryId: projectId,
                  targetId: targetId,
                  targetType: targetType,
                  completeData: post,
                  postId: post.id,
                }),
              });

              if (response.ok) {
                console.log("Successfully added post to project");
                setAddToProjectModalOpen(false);
              } else {
                console.error(
                  "Failed to add post to project:",
                  response.statusText
                );
              }
            } catch (error) {
              console.error("Error adding post to project:", error);
            }
          }}
          onCreateAndAdd={async (projectName) => {
            console.log("Creating project and adding post:", projectName);
            try {
              // First create the project
              const createResponse = await fetch(
                "/api/saved-categories/mongodb",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: userId,
                    name: projectName,
                  }),
                }
              );

              if (createResponse.ok) {
                const projectData = await createResponse.json();
                const projectId = projectData.category.id;

                // Then add the post to the new project
                const addResponse = await fetch(
                  "/api/saved-categories/mongodb",
                  {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      categoryId: projectId,
                      targetId: targetId,
                      targetType: targetType,
                      completeData: post,
                      postId: post.id,
                    }),
                  }
                );

                if (addResponse.ok) {
                  console.log("Successfully created project and added post");
                  setAddToProjectModalOpen(false);
                } else {
                  console.error(
                    "Failed to add post to new project:",
                    addResponse.statusText
                  );
                }
              } else {
                console.error(
                  "Failed to create project:",
                  createResponse.statusText
                );
              }
            } catch (error) {
              console.error("Error creating project and adding post:", error);
            }
          }}
          onSaveWithoutProject={async () => {
            console.log("Saving without project...");
            try {
              // Use the MongoDB bookmarks API which handles UUID strings
              const requestBody = {
                userId: userId,
                targetId: targetId,
                targetType: targetType,
                completePaperData: post.staffPost || post, // Pass complete data for optimization
                // Add postId for reposts so we can fetch the repost in saved content
                postId: post.type === "repost" ? post.postId : undefined,
              };

              console.log("Sending request body:", requestBody);

              const response = await fetch("/api/mongodb/bookmarks", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
              });

              if (response.ok) {
                console.log("Successfully saved without project");
                setAddToProjectModalOpen(false);
              } else {
                const errorData = await response.text();
                console.error(
                  "Failed to save without project:",
                  response.statusText,
                  "Response:",
                  errorData
                );
              }
            } catch (error) {
              console.error("Error saving without project:", error);
            }
          }}
        />
      </Box>
    );
  }
  // Regular post rendering
  return (
    <Box sx={{ width: "100%", overflow: "visible" }}>
      <Card
        key={post.id}
        sx={{
          borderRadius: 2,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          "&:hover": {
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          },
          transition: "box-shadow 0.2s ease-in-out",
          mb: 2,
          width: "100%",
          maxWidth: 800,
          minWidth: 400,
          position: "relative",
          mx: { xs: -2, sm: -4 }, // negative margin for edge bleed
        }}
      >
        {removeButton && (
          <Box sx={{ position: "absolute", top: 0, right: 0, zIndex: 10 }}>
            {removeButton}
          </Box>
        )}
        {showMenu && (
          <IconButton
            sx={{ position: "absolute", top: 10, right: 10, zIndex: 3 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const id = post.post?.id || post.id || post.postId;

              // If menu is already open for this post, close it
              if (openMenu && menuPostId === id) {
                handleMenuClose();
              } else {
                // Otherwise open the menu
                if (id && handleMenuClick) handleMenuClick(e, id);
              }
            }}
          >
            <MoreVertIcon />
          </IconButton>
        )}
        {showMenu &&
          openMenu &&
          menuPostId === (post.post?.id || post.id || post.postId) && (
            <Box
              sx={{
                position: "absolute",
                top: 42, // Just below the three-dot icon
                right: 10,
                zIndex: 9999,
                backgroundColor: "white",
                borderRadius: 1,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                minWidth: 120,
              }}
            >
              <MenuItem onClick={() => handleEdit && handleEdit(post)}>
                Edit
              </MenuItem>
              <MenuItem
                onClick={() =>
                  handleDelete &&
                  handleDelete(post.id || post.post?.id, post.type)
                }
              >
                Delete
              </MenuItem>
            </Box>
          )}

        <CardContent sx={{ pb: 1, width: "100%", px: 4, py: 3 }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <span
              onClick={() => handleUserProfileClick(post.userId)}
              style={{ cursor: "pointer" }}
            >
              <Avatar sx={{ mr: 2, bgcolor: "#1976d2", width: 40, height: 40 }}>
                <PersonIcon sx={{ fontSize: 22 }} />
              </Avatar>
            </span>
            <Box sx={{ flex: 1 }}>
              <span
                onClick={() => handleUserProfileClick(post.userId)}
                style={{ cursor: "pointer" }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {post.userId}
                </Typography>
              </span>
              <Typography variant="caption" color="text.secondary">
                {post.createdAt
                  ? new Date(post.createdAt).toLocaleDateString()
                  : ""}
              </Typography>
            </Box>
          </Box>

          {/* Post content */}
          <Typography
            variant="body1"
            sx={{
              mb: 2,
              lineHeight: 1.6,
              color: "#333",
              wordWrap: "break-word",
              overflowWrap: "break-word",
              whiteSpace: "pre-wrap",
            }}
          >
            {post.content}
          </Typography>
        </CardContent>

        <Divider />

        {/* Actions */}
        <CardActions sx={{ px: 4, py: 2, minHeight: 48 }}>
          <IconButton
            onClick={
              shouldUseBookmarksHook
                ? handleBookmarkClick
                : () => console.log("No valid repost for bookmarking")
            }
            disabled={bookmarkLoading}
            sx={{
              color:
                shouldUseBookmarksHook && bookmarked ? "#1976d2" : "#b0b8c1",
              background:
                shouldUseBookmarksHook && bookmarked
                  ? "#e3f0fd"
                  : "transparent",
              borderRadius: 2,
              transition: "background 0.2s, color 0.2s",
              mr: 0.5,
              "&:hover": { background: "#e3f0fd", color: "#1976d2" },
            }}
          >
            {shouldUseBookmarksHook && bookmarked ? (
              <BookmarkIcon />
            ) : (
              <BookmarkBorderIcon />
            )}
          </IconButton>

          <Box sx={{ flex: 1 }} />

          {/* Comment button moved to desktop version above */}

          {onOpenForum && (
            <Button variant="outlined" onClick={onOpenForum} size="small">
              Open Forum
            </Button>
          )}
        </CardActions>
      </Card>

      {/* Add to Project Modal for Reposts */}
      <AddToProjectModal
        open={addToProjectModalOpen}
        onClose={() => setAddToProjectModalOpen(false)}
        staffPostId={parseInt(targetId) || 0}
        completePaperData={post}
        postId={post.type === "repost" ? post.postId : postId} // Pass the actual postId for reposts
        targetType={targetType} // NEW: Pass the target type (repost or staff_post)
        onAddToProject={async (projectId) => {
          console.log("Adding repost to project:", projectId);
          try {
            // Use the useSavedCategories approach for adding to project
            const response = await fetch("/api/saved-categories/mongodb", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                categoryId: projectId,
                targetId: targetId,
                targetType: targetType,
                completeData: post,
                postId: post.type === "repost" ? post.postId : postId,
              }),
            });

            if (response.ok) {
              console.log("Successfully added repost to project");
              setAddToProjectModalOpen(false);
            } else {
              console.error(
                "Failed to add repost to project:",
                response.statusText
              );
            }
          } catch (error) {
            console.error("Error adding repost to project:", error);
          }
        }}
        onCreateAndAdd={async (projectName) => {
          console.log("Creating project and adding repost:", projectName);
          try {
            // First create the project
            const createResponse = await fetch(
              "/api/saved-categories/mongodb",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: userId,
                  name: projectName,
                }),
              }
            );

            if (createResponse.ok) {
              const projectData = await createResponse.json();
              const projectId = projectData.category.id;

              // Then add the repost to the new project
              const addResponse = await fetch("/api/saved-categories/mongodb", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  categoryId: projectId,
                  targetId: targetId,
                  targetType: targetType,
                  completeData: post,
                  postId: post.type === "repost" ? post.postId : postId,
                }),
              });

              if (addResponse.ok) {
                console.log("Successfully created project and added repost");
                setAddToProjectModalOpen(false);
              } else {
                console.error(
                  "Failed to add repost to new project:",
                  addResponse.statusText
                );
              }
            } else {
              console.error(
                "Failed to create project:",
                createResponse.statusText
              );
            }
          } catch (error) {
            console.error("Error creating project and adding repost:", error);
          }
        }}
        onSaveWithoutProject={async () => {
          console.log("Saving without project...");
          // Bookmark creation is handled automatically by the saved categories API
          console.log("Bookmark will be created automatically when needed");
          setAddToProjectModalOpen(false);
        }}
      />
    </Box>
  );
}

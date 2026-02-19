import React, { useState, useEffect, useCallback } from "react";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ForumPage from "@/app/forum/page";
import CommentPopup from "@/app/forum/CommentPopup";
import { useRouter, usePathname } from "next/navigation";
import Modal from "@mui/material/Modal";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { usePosts } from "@/app/forum/usePosts";
import Avatar from "@mui/material/Avatar";
import PersonIcon from "@mui/icons-material/Person";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Image from "next/image";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import HomeIcon from "@mui/icons-material/Home";
import TagIcon from "@mui/icons-material/Tag";
import NotificationsIcon from "@mui/icons-material/Notifications";
import MailIcon from "@mui/icons-material/Mail";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import GroupsIcon from "@mui/icons-material/Groups";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ArticleIcon from "@mui/icons-material/Article";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import SearchIcon from "@mui/icons-material/Search";
import StaffPostCard from "../home_feed_page/StaffPostCard";
import CommentIcon from "@mui/icons-material/Comment";
import PostList from "../app/forum/PostList";
import NewPostForm from "../app/forum/NewPostForm";
import { useComments } from "../app/forum/useComments";
import ForumLayout from "../app/forum_layout/ForumLayout";
import SavedRepostCard from "../app/saved/SavedRepostCard";
import { useSession } from "next-auth/react";
import ForumTopBar from "../app/forum_layout/ForumTopBar";
import { useConnections } from "../app/profile/useConnections";
import FeedCard from "../app/forum/FeedCard";
import ForumFeedAddToProjectModal from "../app/forum/ForumFeedAddToProjectModal";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

function isRepost(post: any): post is { postId: number } {
  return post && typeof post.postId === "number";
}

// Trending reposts hook with pagination
function useTrendingRepostsInfinite(postsPerPage = 30) {
  const [reposts, setReposts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchReposts = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/feed/trending-reposts?limit=${postsPerPage}&page=${pageNum}`
        );
        const data = await res.json();
        const newReposts = data.reposts || [];
        setReposts((prev) =>
          pageNum === 1 ? newReposts : [...prev, ...newReposts]
        );
        setHasMore(newReposts.length === postsPerPage);
      } catch (err: any) {
        setError(err.message || "Failed to load trending reposts");
      } finally {
        setLoading(false);
      }
    },
    [postsPerPage]
  );

  useEffect(() => {
    fetchReposts(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadMore = () => {
    if (!loading && hasMore) setPage((p) => p + 1);
  };

  const refresh = () => {
    setPage(1);
    fetchReposts(1);
  };

  return { reposts, loading, error, hasMore, loadMore, refresh };
}

const CommentPage: React.FC = () => {
  const [openForumPostId, setOpenForumPostId] = useState<number | null>(null);
  const [openForumTargetId, setOpenForumTargetId] = useState<string | null>(
    null
  );
  const [open, setOpen] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const { posts, loading, error, refresh, createPost, deletePost, editPost } =
    usePosts();

  // Menu state for post actions
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuPostId, setMenuPostId] = useState<number | null>(null);
  const openMenu = Boolean(menuAnchorEl);
  const handleMenuClick = (
    event: React.MouseEvent<HTMLElement>,
    postId: number
  ) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuPostId(postId);
  };
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuPostId(null);
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePostId, setDeletePostId] = useState<number | null>(null);
  const [deletePostType, setDeletePostType] = useState<string | undefined>(
    undefined
  );

  const handleDelete = (id: number, type?: string) => {
    handleMenuClose();
    setDeletePostId(id);
    setDeleteDialogOpen(true);
    // Store the type for deletion
    setDeletePostType(type);
  };

  const handleDeleteConfirm = async () => {
    if (deletePostId !== null) {
      try {
        await deletePost(deletePostId, deletePostType);
        // Refresh the data to reflect the deletion
        if (activeTab === "explore") {
          refreshTrending();
        } else if (activeTab === "connections") {
          // Refresh connections reposts if needed
          // This would need to be implemented if connections reposts have their own refresh
        }
      } catch (e) {
        console.error("Delete error:", e);
        alert("Failed to delete post");
      }
    }
    setDeleteDialogOpen(false);
    setDeletePostId(null);
    setDeletePostType(undefined);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeletePostId(null);
  };

  const handleNewPost = async () => {
    if (!newPostContent.trim()) {
      setPostError("Post cannot be empty");
      return;
    }
    setPosting(true);
    setPostError("");
    try {
      await createPost(userId, newPostContent);
      setNewPostContent("");
      setOpen(false);
    } catch (e) {
      setPostError("Failed to post");
    } finally {
      setPosting(false);
    }
  };

  // Edit modal state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPostId, setEditPostId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [editPostType, setEditPostType] = useState<string | undefined>(
    undefined
  );

  // Global modal state for FeedCard
  const [globalModalOpen, setGlobalModalOpen] = useState(false);
  const [globalModalPostId, setGlobalModalPostId] = useState<number | null>(
    null
  );
  const [globalModalStaffPostId, setGlobalModalStaffPostId] = useState<
    number | null
  >(null);

  // Global modal handlers
  const handleGlobalModalOpen = (postId: number, staffPostId?: number) => {
    console.log("handleGlobalModalOpen called with:", { postId, staffPostId });
    console.log("Setting global modal state:", {
      postId,
      staffPostId: staffPostId || null,
      open: true,
    });
    setGlobalModalPostId(postId);
    setGlobalModalStaffPostId(staffPostId || null);
    setGlobalModalOpen(true);
  };

  const handleGlobalModalClose = () => {
    setGlobalModalOpen(false);
    setGlobalModalPostId(null);
    setGlobalModalStaffPostId(null);
  };

  // Modal handlers for the real modal
  const handleAddToProject = async (projectId: number) => {
    if (!globalModalPostId) return;
    try {
      await fetch("/api/saved-categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: projectId,
          postId: globalModalPostId,
        }),
      });
      handleGlobalModalClose();
    } catch (error) {
      console.error("Error adding to project:", error);
    }
  };

  const handleCreateAndAdd = async (projectName: string) => {
    if (!globalModalPostId) return;
    try {
      console.log("CommentPage: Creating new project:", projectName);
      // Create new category
      const createResponse = await fetch("/api/saved-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: projectName }),
      });
      const createData = await createResponse.json();

      if (createData.category) {
        console.log(
          "CommentPage: Project created, adding post to category:",
          createData.category.id
        );
        // Add post to the new category
        await fetch("/api/saved-categories", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: createData.category.id,
            postId: globalModalPostId,
          }),
        });
      }
      handleGlobalModalClose();
    } catch (error) {
      console.error("Error creating project and adding post:", error);
    }
  };

  const handleSaveWithoutProject = async () => {
    if (!globalModalPostId) return;
    try {
      await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, postId: globalModalPostId }),
      });
      handleGlobalModalClose();
    } catch (error) {
      console.error("Error saving without project:", error);
    }
  };

  const handleEdit = (post: any) => {
    handleMenuClose();
    // For reposts, use postId; for regular posts, use id
    const editId = post.type === "repost" ? post.postId : post.id;
    setEditPostId(editId);
    setEditContent(post.content);
    setEditPostType(post.type);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editContent.trim() || editPostId === null) return;
    setEditing(true);
    setEditError("");
    try {
      await editPost(editPostId, editContent, editPostType);

      // Refresh the data to reflect the edit
      if (activeTab === "explore") {
        refreshTrending();
      } else if (activeTab === "connections") {
        // Refresh connections reposts if needed
        // This would need to be implemented if connections reposts have their own refresh
      }

      setEditDialogOpen(false);
      setEditPostId(null);
      setEditContent("");
      setEditPostType(undefined);
    } catch (e) {
      console.error("Edit error:", e);
      setEditError("Failed to update post");
    } finally {
      setEditing(false);
    }
  };

  const handleEditCancel = () => {
    setEditDialogOpen(false);
    setEditPostId(null);
    setEditContent("");
  };

  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";

  // Get user display name from session
  const getUserDisplayName = () => {
    if (session && typeof session.user === "object") {
      const firstName =
        "firstName" in session.user ? session.user.firstName : undefined;
      const lastName =
        "lastName" in session.user ? session.user.lastName : undefined;
      if (firstName || lastName) {
        return `${firstName || ""} ${lastName || ""}`.trim();
      }
      if (session.user.name) return session.user.name;
      if (session.user.email) return session.user.email;
    }
    return userId;
  };

  // Tab state for Explore/Saved
  const [activeTab, setActiveTab] = useState<"explore" | "connections">(
    "explore"
  );
  const [connectionsReposts, setConnectionsReposts] = useState<any[]>([]);
  const [connectionsRepostsLoading, setConnectionsRepostsLoading] =
    useState(false);
  const [connectionsRepostsError, setConnectionsRepostsError] = useState<
    string | null
  >(null);
  const { connections, loading: connectionsLoading } = useConnections(userId);

  // Fetch connections reposts when Connections tab is active
  useEffect(() => {
    if (activeTab !== "connections" || connectionsLoading) return;
    if (!connections || connections.length === 0) {
      setConnectionsReposts([]);
      return;
    }
    setConnectionsRepostsLoading(true);
    setConnectionsRepostsError(null);
    fetch(`/api/reposts/mongodb`)
      .then((res) => res.json())
      .then((data) => {
        console.log("DEBUG: connections:", connections);
        console.log("DEBUG: all reposts:", data.reposts || data);
        const reposts = (data.reposts || data).filter((p: any) => {
          const match = connections.some((c: any) => c.id === p.userId);
          if (match) {
            console.log("MATCH:", {
              repostUserId: p.userId,
              connectionIds: connections.map((c) => c.id),
            });
          }
          return p && match;
        });
        setConnectionsReposts(
          reposts.sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        );
        setConnectionsRepostsLoading(false);
      })
      .catch((e) => {
        setConnectionsRepostsError(
          e.message || "Failed to load connections reposts"
        );
        setConnectionsRepostsLoading(false);
      });
  }, [activeTab, connections, connectionsLoading]);

  // Trending reposts state lifted up
  const {
    reposts: trendingReposts,
    loading: trendingLoading,
    error: trendingError,
    hasMore: trendingHasMore,
    loadMore: loadMoreTrending,
    refresh: refreshTrending,
  } = useTrendingRepostsInfinite(30);

  // Allow natural scrolling
  useEffect(() => {
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });

  return (
    <ForumLayout
      userId={userId}
      activeTab={activeTab}
      onTabChange={(tab: string) => {
        if (tab === "explore" || tab === "connections") setActiveTab(tab);
      }}
      tabs={[
        { label: "Explore", value: "explore" },
        { label: "Connections", value: "connections" },
      ]}
    >
      {/* Main content area previously in the center feed container */}
      <Container
        maxWidth={false}
        disableGutters
        sx={{
          width: isMobile ? "100vw" : "100%",
          maxWidth: isMobile ? "100vw" : 1200,
          minWidth: 0,
          overflowX: "auto",
          p: 0,
          m: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: isMobile ? "stretch" : "center",
          flex: 1,
          zIndex: 0,
          margin: 0,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: isMobile ? "stretch" : "center",
            flex: 6,
            height: "100%",
            gap: 2,
            width: "100%",
            pt: 2,
            pb: 30,
            px: isMobile ? 0 : 2,
            maxWidth: isMobile ? "100vw" : "100%",
            overflowY: "auto",
            overflowX: "hidden",
          }}
          ref={(el) => {
            if (!el) return;
            // Infinite scroll: load more when near bottom
            const element = el as HTMLElement;
            element.onscroll = () => {
              if (
                element.scrollTop + element.clientHeight >=
                  element.scrollHeight - 200 &&
                !trendingLoading &&
                trendingHasMore
              ) {
                loadMoreTrending();
              }
            };
          }}
        >
          {activeTab === "explore" ? (
            <>
              {trendingLoading && <Typography>Loading posts...</Typography>}
              {trendingError && (
                <Typography color="error">{trendingError}</Typography>
              )}
              {trendingReposts.map((post) => {
                console.log(" CommentPage trending repost data:", {
                  postId: post.postId,
                  staffPostId: post.staffPostId,
                  hasStaffPost: !!post.staffPost,
                  staffPost: post.staffPost,
                  targetType: post.targetType,
                  hasEurekaData: !!post.eurekaData,
                  eurekaDataKeys: post.eurekaData
                    ? Object.keys(post.eurekaData)
                    : null,
                  postKeys: Object.keys(post),
                });
                return (
                  <FeedCard
                    key={`${post.id}-${Date.now()}`}
                    post={{
                      ...post,
                      type: "repost",
                      targetType: post.targetType,
                      eurekaData: post.eurekaData,
                    }}
                    userId={userId}
                    onOpenForum={() => router.push(`/forum/${post.postId}`)}
                    onComment={async () => {
                      console.log(" Comment button clicked for repost:", {
                        postId: post.postId,
                        targetId: post.targetId,
                        postData: post,
                      });

                      // Fetch the repost data to get the targetId
                      try {
                        const response = await fetch(
                          `/api/reposts/mongodb?userId=${userId}`
                        );
                        const data = await response.json();
                        const reposts = data.reposts || data;
                        const repost = Array.isArray(reposts)
                          ? reposts.find((r) => r.postId === post.postId)
                          : null;

                        if (repost && repost.targetId) {
                          console.log(
                            " Found repost with targetId:",
                            repost.targetId
                          );
                          setOpenForumPostId(post.postId);
                          // For reposts, use unique identifier instead of shared targetId
                          setOpenForumTargetId(`repost:${post.postId}`);
                        } else {
                          console.log(
                            " Using fallback targetId:",
                            post.targetId
                          );
                          setOpenForumPostId(post.postId);
                          // For reposts, use unique identifier instead of shared targetId
                          setOpenForumTargetId(`repost:${post.postId}`);
                        }
                      } catch (error) {
                        console.error(" Error fetching repost data:", error);
                        // Fallback to using the post data
                        setOpenForumPostId(post.postId);
                        // For reposts, use unique identifier instead of shared targetId
                        setOpenForumTargetId(`repost:${post.postId}`);
                      }
                    }}
                    menuAnchorEl={menuAnchorEl}
                    openMenu={openMenu}
                    menuPostId={menuPostId}
                    handleMenuClick={handleMenuClick}
                    handleMenuClose={handleMenuClose}
                    handleEdit={handleEdit}
                    handleDelete={handleDelete}
                    showMenu={post.userId === userId}
                    onBookmarkClick={() => {
                      console.log("Bookmark clicked for post:", {
                        postId: post.postId,
                        staffPostId: post.staffPost?.id,
                        staffPost: post.staffPost,
                        fullPost: post,
                        postType: post.type,
                      });
                      console.log("Calling handleGlobalModalOpen with:", {
                        postId: post.postId,
                        staffPostId: post.staffPost?.id,
                      });
                      handleGlobalModalOpen(post.postId, post.staffPost?.id);
                    }}
                  />
                );
              })}
              {trendingLoading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <Typography>Loading more...</Typography>
                </Box>
              )}
            </>
          ) : (
            <>
              {console.log("RENDER: connectionsReposts", connectionsReposts)}
              {connectionsLoading || connectionsRepostsLoading ? (
                <Typography>Loading connections reposts...</Typography>
              ) : connectionsRepostsError ? (
                <Typography color="error">{connectionsRepostsError}</Typography>
              ) : connectionsReposts.length === 0 ? (
                <Typography sx={{ color: "#888", py: 8 }}>
                  No reposts from your connections yet.
                </Typography>
              ) : (
                connectionsReposts.map((post) => {
                  console.log(" CommentPage connections repost data:", {
                    postId: post.postId,
                    staffPostId: post.staffPostId,
                    hasStaffPost: !!post.staffPost,
                    staffPost: post.staffPost,
                    targetType: post.targetType,
                    hasEurekaData: !!post.eurekaData,
                    eurekaDataKeys: post.eurekaData
                      ? Object.keys(post.eurekaData)
                      : null,
                    postKeys: Object.keys(post),
                  });
                  return (
                    <FeedCard
                      key={post.id}
                      post={{
                        ...post,
                        type: "repost",
                        staffPost: post.staffPost,
                        targetType: post.targetType,
                        eurekaData: post.eurekaData,
                      }}
                      userId={userId}
                      onOpenForum={() => router.push(`/forum/${post.postId}`)}
                      onComment={async () => {
                        console.log(" Comment button clicked for repost:", {
                          postId: post.postId,
                          targetId: post.targetId,
                          postData: post,
                        });

                        // Fetch the repost data to get the targetId
                        try {
                          const response = await fetch(
                            `/api/reposts/mongodb?userId=${userId}`
                          );
                          const data = await response.json();
                          const reposts = data.reposts || data;
                          const repost = Array.isArray(reposts)
                            ? reposts.find((r) => r.postId === post.postId)
                            : null;

                          if (repost && repost.targetId) {
                            console.log(
                              " Found repost with targetId:",
                              repost.targetId
                            );
                            setOpenForumPostId(post.postId);
                            // For reposts, use unique identifier instead of shared targetId
                            setOpenForumTargetId(`repost:${post.postId}`);
                          } else {
                            console.log(
                              " Using fallback targetId:",
                              post.targetId
                            );
                            setOpenForumPostId(post.postId);
                            // For reposts, use unique identifier instead of shared targetId
                            setOpenForumTargetId(`repost:${post.postId}`);
                          }
                        } catch (error) {
                          console.error(
                            " Error fetching repost data:",
                            error
                          );
                          // Fallback to using the post data
                          setOpenForumPostId(post.postId);
                          // For reposts, use unique identifier instead of shared targetId
                          setOpenForumTargetId(`repost:${post.postId}`);
                        }
                      }}
                      menuAnchorEl={menuAnchorEl}
                      openMenu={openMenu}
                      menuPostId={menuPostId}
                      handleMenuClick={handleMenuClick}
                      handleMenuClose={handleMenuClose}
                      handleEdit={handleEdit}
                      handleDelete={handleDelete}
                      showMenu={post.userId === userId}
                      onBookmarkClick={() => {
                        console.log("Bookmark clicked for post:", {
                          postId: post.postId,
                          staffPostId: post.staffPost?.id,
                          staffPost: post.staffPost,
                          fullPost: post,
                          postType: post.type,
                        });
                        console.log("Calling handleGlobalModalOpen with:", {
                          postId: post.postId,
                          staffPostId: post.staffPost?.id,
                        });
                        handleGlobalModalOpen(post.postId, post.staffPost?.id);
                      }}
                    />
                  );
                })
              )}
            </>
          )}
          {/* Comments side popup for openForumPostId */}
          {openForumPostId && (
            <>
              {/* Backdrop */}
              <Box
                sx={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  bgcolor: isMobile
                    ? "rgba(0, 0, 0, 0.5)"
                    : "rgba(0, 0, 0, 0.09)",
                  zIndex: 2999,
                  ...(isMobile && {
                    backdropFilter: "blur(2px)",
                  }),
                }}
                onClick={() => {
                  console.log(" Backdrop clicked, closing modal");
                  setOpenForumPostId(null);
                  setOpenForumTargetId(null);
                }}
              />
              {/* Forum Panel */}
              <Box
                sx={{
                  position: "fixed",
                  top: isMobile ? 0 : 72,
                  right: isMobile ? 0 : 32,
                  bottom: isMobile ? 0 : 32,
                  left: isMobile ? 0 : "auto",
                  width: isMobile ? "100vw" : 420,
                  bgcolor: "white",
                  color: "black",
                  borderRadius: isMobile ? 0 : 4,
                  boxShadow: isMobile ? "none" : "0 8px 32px rgba(0,0,0,0.18)",
                  zIndex: 3000,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  height: isMobile ? "100vh" : "calc(100vh - 72px - 32px)",
                  maxHeight: "100vh",
                }}
              >
                {/* Header with close button */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: isMobile ? "space-between" : "flex-end",
                    p: isMobile ? 3 : 2,
                    borderBottom: isMobile ? "1px solid #e0e0e0" : "none",
                    bgcolor: isMobile ? "#f8f9fa" : "transparent",
                  }}
                >
                  {isMobile && (
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: "#333",
                        fontSize: 18,
                      }}
                    >
                      Comments
                    </Typography>
                  )}
                  <IconButton
                    onClick={() => {
                      setOpenForumPostId(null);
                      setOpenForumTargetId(null);
                    }}
                    sx={{
                      color: "#888",
                      ...(isMobile && {
                        bgcolor: "#fff",
                        border: "1px solid #e0e0e0",
                        "&:hover": {
                          bgcolor: "#f5f5f5",
                        },
                      }),
                    }}
                    aria-label="Close"
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
                {/* ForumPage content for the selected post, inlined here */}
                <Box
                  sx={{
                    flex: 1,
                    overflowY: "auto",
                    maxHeight: "100%",
                    ...(isMobile && {
                      px: 2,
                      pt: 1,
                    }),
                  }}
                >
                  <CommentPopup
                    postId={openForumPostId}
                    targetId={openForumTargetId}
                  />
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Container>

      {/* Global Modal for FeedCard */}
      <ForumFeedAddToProjectModal
        open={globalModalOpen}
        onClose={handleGlobalModalClose}
        postId={globalModalPostId || 0}
        staffPostId={globalModalStaffPostId || undefined}
        onAddToProject={handleAddToProject}
        onCreateAndAdd={handleCreateAndAdd}
        onSaveWithoutProject={handleSaveWithoutProject}
      />

      {/* Modal for new post */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            bgcolor: "rgba(0,0,0,0.7)",
            zIndex: 2100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              bgcolor: "white",
              color: "#181c24",
              borderRadius: 4,
              width: 420,
              maxWidth: "90vw",
              p: 0,
              boxShadow: 6,
              display: "flex",
              flexDirection: "column",
              gap: 0,
              position: "relative",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                p: 2,
                pb: 0,
              }}
            ></Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 2,
                px: 3,
                pt: 3,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Avatar
                  sx={{ bgcolor: "#1976d2", width: 40, height: 40, mr: 1 }}
                >
                  <PersonIcon sx={{ fontSize: 22 }} />
                </Avatar>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, color: "black" }}
                >
                  {userId}
                </Typography>
              </Box>
              <IconButton
                onClick={() => setOpen(false)}
                sx={{ color: "#888" }}
                aria-label="Close"
              >
                <CloseIcon />
              </IconButton>
            </Box>
            <Box sx={{ p: 3, pt: 1 }}>
              <TextField
                multiline
                minRows={3}
                maxRows={8}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="What's happening?"
                variant="outlined"
                fullWidth
                InputProps={{
                  sx: {
                    bgcolor: "#f5f5f5",
                    color: "#181c24",
                    borderRadius: 2,
                    fontSize: 18,
                  },
                }}
                sx={{ mb: 2 }}
              />
              {postError && (
                <Box sx={{ color: "#ff5252", mb: 1, fontSize: 15 }}>
                  {postError}
                </Box>
              )}
              <Button
                variant="contained"
                color="primary"
                onClick={handleNewPost}
                disabled={posting}
                sx={{
                  fontWeight: 600,
                  fontSize: 16,
                  alignSelf: "flex-end",
                  px: 4,
                }}
              >
                {posting ? "Posting..." : "Post"}
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>
      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Post?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this post? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDeleteCancel}
            color="primary"
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      {/* Edit post modal */}
      <Modal open={editDialogOpen} onClose={handleEditCancel}>
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            bgcolor: "rgba(0,0,0,0.7)",
            zIndex: 2100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              bgcolor: "white",
              color: "#181c24",
              borderRadius: 4,
              width: 420,
              maxWidth: "90vw",
              p: 0,
              boxShadow: 6,
              display: "flex",
              flexDirection: "column",
              gap: 0,
              position: "relative",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 2,
                px: 3,
                pt: 3,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Avatar
                  sx={{ bgcolor: "#1976d2", width: 40, height: 40, mr: 1 }}
                >
                  <PersonIcon sx={{ fontSize: 22 }} />
                </Avatar>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, color: "black" }}
                >
                  {getUserDisplayName()}
                </Typography>
              </Box>
              <IconButton
                onClick={handleEditCancel}
                sx={{ color: "#888" }}
                aria-label="Close"
              >
                <CloseIcon />
              </IconButton>
            </Box>
            <Box sx={{ px: 3, pb: 3, pt: 0 }}>
              <TextField
                multiline
                minRows={3}
                maxRows={8}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Edit your post..."
                variant="outlined"
                fullWidth
                InputProps={{
                  sx: {
                    bgcolor: "#f5f5f5",
                    color: "#181c24",
                    borderRadius: 2,
                    fontSize: 18,
                  },
                }}
                sx={{ mb: 2 }}
              />
              {editError && (
                <Box sx={{ color: "#ff5252", mb: 1, fontSize: 15 }}>
                  {editError}
                </Box>
              )}
              <Button
                variant="contained"
                color="primary"
                onClick={handleEditSubmit}
                disabled={editing}
                sx={{
                  fontWeight: 600,
                  fontSize: 16,
                  alignSelf: "flex-end",
                  px: 4,
                }}
              >
                {editing ? "Editing..." : "Edit"}
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>
      {/* Mobile: Bottom tab bar for Explore/Connections */}
      {isMobile && (
        <Box
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: "100vw",
            height: 56,
            bgcolor: "#fff",
            borderTop: "1px solid #e0e3e8",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            zIndex: 2000,
            boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <Button
            onClick={() => setActiveTab("explore")}
            sx={{
              flex: 1,
              fontWeight: 700,
              fontSize: 16,
              color: activeTab === "explore" ? "#1976d2" : "#888",
              borderRadius: 0,
              height: "100%",
              bgcolor: "transparent",
              borderBottom:
                activeTab === "explore" ? "3px solid #1976d2" : "none",
              boxShadow: "none",
              textTransform: "none",
            }}
            disableRipple
          >
            Explore
          </Button>
          <Button
            onClick={() => setActiveTab("connections")}
            sx={{
              flex: 1,
              fontWeight: 700,
              fontSize: 16,
              color: activeTab === "connections" ? "#1976d2" : "#888",
              borderRadius: 0,
              height: "100%",
              bgcolor: "transparent",
              borderBottom:
                activeTab === "connections" ? "3px solid #1976d2" : "none",
              boxShadow: "none",
              textTransform: "none",
            }}
            disableRipple
          >
            Connections
          </Button>
        </Box>
      )}
    </ForumLayout>
  );
};

export default CommentPage;

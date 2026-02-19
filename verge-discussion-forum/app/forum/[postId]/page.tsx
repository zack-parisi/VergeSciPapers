"use client";
import PostList from "../PostList";
import NewPostForm from "../NewPostForm";
import { useComments } from "../useComments";
import Box from "@mui/material/Box";
import { useRouter, useSearchParams } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import PersonIcon from "@mui/icons-material/Person";
import { useEffect, useState, use } from "react";
import FeedCard from "../FeedCard";
import { useSession } from "next-auth/react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import ClientLayout from "../../client-layout";
import StaffPostCard from "../../../home_feed_page/StaffPostCard";
import MongoDBPaperCard from "../../components/MongoDBPaperCard";

interface Params {
  params: Promise<{ postId: string }>;
}

export default function PostForumPageWrapper(props: Params) {
  return (
    <ClientLayout>
      <PostForumPage {...props} />
    </ClientLayout>
  );
}

function PostForumPage({ params }: Params) {
  const unwrappedParams = use(params);
  const postId = unwrappedParams.postId;
  // Check if postId is a UUID (contains hyphens) or numeric ID
  const isUUID = postId.includes("-");
  const postIdNum = isUUID ? NaN : Number(postId);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated" && !!session?.userId;
  const userId = isAuthenticated ? (session!.userId as string) : "";

  // Debug session data
  console.log(" Forum page session data:", {
    session: session,
    sessionUserId: session?.userId,
    finalUserId: userId,
    sessionStatus: status,
    isAuthenticated,
  });

  // Fetch the real user profile from the backend
  const [profileUser, setProfileUser] = useState<any>(null);
  useEffect(() => {
    if (!isAuthenticated) return;
    console.log(" Fetching user profile for userId:", userId);
    fetch(`/api/profile/mongodb/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        console.log(" User profile data received:", data);
        setProfileUser(data);
      })
      .catch((error) => {
        console.error(" Error fetching user profile:", error);
        setProfileUser(null);
      });
  }, [isAuthenticated, userId]);

  // Determine if this is a MongoDB paper and construct targetId if needed
  const [targetId, setTargetId] = useState<string | undefined>(undefined);

  const { comments, loading, error, refresh } = useComments(
    undefined, // Don't pass postId since it's a string UUID
    undefined,
    undefined,
    targetId
  );

  // Debug comments loading
  useEffect(() => {
    console.log(" Comments debug:", {
      targetId,
      commentsCount: comments?.length || 0,
      loading,
      error,
      comments: comments?.slice(0, 2), // Show first 2 comments for debugging
    });
  }, [targetId, comments, loading, error]);
  const router = useRouter();
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const fromSaved = searchParams?.get("from") === "saved";

  // Fetch the actual post or repost
  const [post, setPost] = useState<any>(null);
  const [postLoading, setPostLoading] = useState(true);
  const [postError, setPostError] = useState("");

  // Show/hide post toggle
  const [showPost, setShowPost] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setPostLoading(true);
    setPostError("");

    console.log(" Forum page useEffect triggered with postIdNum:", postIdNum);

    // First, check if this is a repost by looking for a repost with this postId
    // If postId is a UUID, fetch the specific repost by postId
    const repostApiUrl = isUUID
      ? `/api/reposts/mongodb?postId=${postId}`
      : `/api/reposts/mongodb?userId=${userId}`;

    fetch(repostApiUrl)
      .then((r) => r.json())
      .then((repostsData) => {
        if (!isMounted) return;

        // Handle new paginated response structure
        const reposts = repostsData.reposts || repostsData;
        const repost = Array.isArray(reposts)
          ? isUUID
            ? reposts[0]
            : reposts.find((r) => r.postId === postId)
          : null;

        if (repost) {
          // This is a repost, set it with the type
          console.log("Found repost:", repost);
          setPost({ ...repost, type: "repost" });

          // Set targetId for repost comments - use unique identifier
          console.log(" Setting targetId for repost using unique identifier");
          setTargetId(`repost:${postId}`);

          setPostLoading(false);
        } else if (isUUID) {
          // This is a UUID but not a repost - show error
          console.log(" UUID found but no repost exists:", postId);
          setPostError("Repost not found");
          setPostLoading(false);
        } else if (!isUUID) {
          // Not a repost and not a UUID, try to fetch as MongoDB paper first
          // For MongoDB papers, we need to construct the full OpenAlex ID
          const openAlexId = `openalex:https://openalex.org/W${postIdNum}`;
          console.log(" Trying to fetch MongoDB paper with ID:", openAlexId);

          fetch(`/api/papers/mongodb`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paperIds: [openAlexId] }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (!isMounted) return;

              console.log(" MongoDB paper fetch response:", data);

              if (data.success && data.papers && data.papers.length > 0) {
                // Found as MongoDB paper
                const fetchedPaper = data.papers[0];
                console.log(" Found MongoDB paper:", fetchedPaper.title);
                console.log(" Paper linkId:", fetchedPaper.linkId);
                setPost(fetchedPaper);
                // Set targetId for MongoDB papers
                setTargetId(fetchedPaper.linkId);
                setPostLoading(false);
              } else {
                console.log(" No MongoDB paper found, trying regular post");
                // Try as regular post
                fetch(`/api/posts?id=${postIdNum}`)
                  .then((res) => res.json())
                  .then((postData) => {
                    if (!isMounted) return;
                    let foundPost = null;
                    if (Array.isArray(postData)) {
                      foundPost =
                        postData.find((p) => p.id === postIdNum) || null;
                    } else if (postData && postData.id === postIdNum) {
                      foundPost = postData;
                    }
                    if (!foundPost) {
                      console.log(" No regular post found either");
                      setPost(null);
                    } else {
                      console.log(" Found regular post:", foundPost);
                      setPost(foundPost);
                    }
                    setPostLoading(false);
                  })
                  .catch(() => {
                    if (!isMounted) return;
                    setPostError("Failed to load post");
                    setPostLoading(false);
                  });
              }
            })
            .catch((error) => {
              console.log(" Error fetching MongoDB paper:", error);
              // If MongoDB paper fetch fails, try as regular post
              fetch(`/api/posts?id=${postIdNum}`)
                .then((res) => res.json())
                .then((data) => {
                  if (!isMounted) return;
                  let foundPost = null;
                  if (Array.isArray(data)) {
                    foundPost = data.find((p) => p.id === postIdNum) || null;
                  } else if (data && data.id === postIdNum) {
                    foundPost = data;
                  }
                  if (!foundPost) {
                    setPost(null);
                  } else {
                    setPost(foundPost);
                  }
                  setPostLoading(false);
                })
                .catch(() => {
                  if (!isMounted) return;
                  setPostError("Failed to load post");
                  setPostLoading(false);
                });
            });
        }
      })
      .catch((error) => {
        console.log(" Error fetching reposts:", error);
        // If repost fetch fails and it's not a UUID, try as MongoDB paper first, then regular post
        if (!isUUID) {
          // For MongoDB papers, we need to construct the full OpenAlex ID
          const openAlexId = `openalex:https://openalex.org/W${postIdNum}`;
          console.log(" Trying to fetch MongoDB paper with ID:", openAlexId);

          fetch(`/api/papers/mongodb`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paperIds: [openAlexId] }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (!isMounted) return;

              console.log(" MongoDB paper fetch response:", data);

              if (data.success && data.papers && data.papers.length > 0) {
                // Found as MongoDB paper
                const fetchedPaper = data.papers[0];
                console.log(" Found MongoDB paper:", fetchedPaper.title);
                console.log(" Paper linkId:", fetchedPaper.linkId);
                setPost(fetchedPaper);
                setPostLoading(false);
              } else {
                console.log(" No MongoDB paper found, trying regular post");
                // Try as regular post
                fetch(`/api/posts?id=${postIdNum}`)
                  .then((res) => res.json())
                  .then((postData) => {
                    if (!isMounted) return;
                    let foundPost = null;
                    if (Array.isArray(postData)) {
                      foundPost =
                        postData.find((p) => p.id === postIdNum) || null;
                    } else if (postData && postData.id === postIdNum) {
                      foundPost = postData;
                    }
                    if (!foundPost) {
                      console.log(" No regular post found either");
                      setPost(null);
                    } else {
                      console.log(" Found regular post:", foundPost);
                      setPost(foundPost);
                    }
                    setPostLoading(false);
                  })
                  .catch(() => {
                    if (!isMounted) return;
                    setPostError("Failed to load post");
                    setPostLoading(false);
                  });
              }
            })
            .catch((error) => {
              console.log(" Error fetching MongoDB paper:", error);
              // If MongoDB paper fetch fails, try as regular post
              fetch(`/api/posts?id=${postIdNum}`)
                .then((res) => res.json())
                .then((data) => {
                  if (!isMounted) return;
                  let foundPost = null;
                  if (Array.isArray(data)) {
                    foundPost = data.find((p) => p.id === postIdNum) || null;
                  } else if (data && data.id === postIdNum) {
                    foundPost = data;
                  }
                  if (!foundPost) {
                    setPost(null);
                  } else {
                    setPost(foundPost);
                  }
                  setPostLoading(false);
                })
                .catch(() => {
                  if (!isMounted) return;
                  setPostError("Failed to load post");
                  setPostLoading(false);
                });
            });
        } else {
          // It's a UUID but repost fetch failed - show error
          console.log(" UUID found but repost fetch failed:", postId);
          setPostError("Failed to load repost");
          setPostLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [postIdNum, userId]);

  return (
    <Box
      sx={{
        bgcolor: "white",
        color: "black",
        borderRadius: 2,
        p: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2,
          display: "flex",
          flexDirection: "column",
          "::-webkit-scrollbar": {
            width: "8px",
          },
          "::-webkit-scrollbar-thumb": {
            background: "#e0e0e0",
            borderRadius: "8px",
          },
          "::-webkit-scrollbar-track": {
            background: "transparent",
          },
          scrollbarWidth: "thin",
          scrollbarColor: "#e0e0e0 transparent",
          pb: 2, // Small bottom padding for scroll space, but not blocking comments
        }}
      >
        {/* Back to Posts button */}
        <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 2 }}>
          <IconButton
            onClick={() => {
              if (fromSaved) {
                router.push("/saved");
              } else if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/forum-feed");
              }
            }}
            sx={{ color: "#1976d2", p: 0.5 }}
            aria-label="Back"
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>
        </Box>
        {/* Hide/See Post toggle button */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            sx={{ fontWeight: 600, borderRadius: 2, px: 2, py: 0.5 }}
            onClick={() => setShowPost((v) => !v)}
          >
            {showPost ? "Hide Post" : "See Post"}
          </Button>
        </Box>
        {/* Actual post at the top */}
        {showPost && (
          <Box
            sx={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              mb: 3,
            }}
          >
            {postLoading ? (
              <Typography>Loading post...</Typography>
            ) : postError ? (
              <Typography color="error">{postError}</Typography>
            ) : post ? (
              // Debug: Log the post structure before rendering
              (() => {
                console.log(" Rendering post in forum page:", {
                  post,
                  linkId: post.linkId,
                  title: post.title,
                  id: post.id,
                  type: post.type,
                });

                // Check if this is a repost
                if (post.type === "repost") {
                  console.log(" Rendering repost with FeedCard");
                  return (
                    <FeedCard
                      post={post}
                      userId={userId}
                      showMenu={false}
                      inForumPage={true}
                    />
                  );
                }

                // Check if this is a MongoDB paper (has linkId starting with 'openalex:')
                const isMongoDBPaper =
                  post.linkId && post.linkId.startsWith("openalex:");
                console.log(" Is MongoDB paper:", isMongoDBPaper);

                if (isMongoDBPaper) {
                  console.log(
                    " Rendering MongoDB paper with StaffPostCard (same as home feed)"
                  );
                  return (
                    <StaffPostCard
                      post={post}
                      showBookmark={false}
                      compact={false}
                    />
                  );
                } else {
                  console.log(" Rendering regular post with FeedCard");
                  return (
                    <FeedCard
                      post={post}
                      userId={userId}
                      showMenu={false}
                      inForumPage={true}
                    />
                  );
                }
              })()
            ) : (
              <Typography color="error">Post not found</Typography>
            )}
          </Box>
        )}
        <PostList
          comments={comments}
          loading={loading}
          error={error}
          refresh={refresh}
          postId={undefined}
          targetId={targetId}
          userId={userId}
        />
      </Box>
      <Box
        sx={{
          borderTop: "1px solid #eee",
          p: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box sx={{ width: "100%", p: 2 }}>
          {(() => {
            console.log(" NewPostForm props:", {
              postId: undefined,
              targetId,
              userId,
              currentUser: profileUser,
              isAuthenticated,
            });

            // Show login prompt if not authenticated
            if (!isAuthenticated) {
              return (
                <Box sx={{ p: 2, textAlign: "center", color: "#666" }}>
                  Please log in to comment.
                </Box>
              );
            }

            // Show loading state if profileUser is not loaded yet
            if (!profileUser) {
              return (
                <Box sx={{ p: 2, textAlign: "center", color: "#666" }}>
                  Loading user profile...
                </Box>
              );
            }

            return (
              <NewPostForm
                postId={undefined}
                targetId={targetId}
                userId={userId}
                currentUser={profileUser}
                onPost={refresh}
              />
            );
          })()}
        </Box>
      </Box>
    </Box>
  );
}

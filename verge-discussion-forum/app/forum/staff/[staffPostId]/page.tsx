"use client";
import PostList from "../../PostList";
import NewPostForm from "../../NewPostForm";
import { useComments } from "../../useComments";
import Box from "@mui/material/Box";
import { useRouter } from "next/navigation";
import Typography from "@mui/material/Typography";
import { useEffect, useState, use } from "react";
import StaffPostCard from "../../../../home_feed_page/StaffPostCard";
import { useSession } from "next-auth/react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import React from "react";
import ClientLayout from "../../../client-layout";

interface Params {
  params: Promise<{ staffPostId: string }>;
}

export default function StaffForumPageWrapper(props: Params) {
  return (
    <ClientLayout>
      <StaffForumPage {...props} />
    </ClientLayout>
  );
}

function StaffForumPage({ params }: Params) {
  const unwrappedParams = use(params);
  const staffPostIdNum = Number(unwrappedParams.staffPostId);
  const { data: session } = useSession();
  const userId = session?.userId || "test-user-1";

  // Fetch the real user profile from the backend
  const [profileUser, setProfileUser] = useState<any>(null);
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/profile/mongodb/${userId}`)
      .then((res) => res.json())
      .then((data) => setProfileUser(data))
      .catch(() => setProfileUser(null));
  }, [userId]);

  // Construct the targetId for staff posts (same as bookmarking system)
  const targetId = `openalex:https://openalex.org/W${staffPostIdNum}`;

  const { comments, loading, error, refresh } = useComments(
    undefined,
    staffPostIdNum,
    undefined,
    targetId
  );
  const router = useRouter();

  // Fetch the actual staff post
  const [staffPost, setStaffPost] = useState<any>(null);
  const [postLoading, setPostLoading] = useState(true);
  const [postError, setPostError] = useState("");
  // Show/hide post toggle
  const [showPost, setShowPost] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setPostLoading(true);
    setPostError("");
    fetch(`/api/staff-posts?postId=${staffPostIdNum}&contextSize=0`)
      .then((res) => res.json())
      .then((data) => {
        let foundPost = null;
        if (data.posts && data.posts.length > 0) {
          foundPost = data.posts[0];
        }
        setStaffPost(foundPost);
        setPostLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setPostError("Failed to load staff post");
        setPostLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [staffPostIdNum]);

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
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          p: 2,
          minHeight: 0,
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
          pb: 2,
        }}
      >
        {/* Back to Posts button */}
        <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 2 }}>
          <IconButton
            onClick={() => router.back()}
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
        {/* Staff post as first item in feed */}
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
            ) : staffPost ? (
              <StaffPostCard
                post={staffPost}
                hideRepostButton={true}
                showBookmark={false}
                hideActions={true}
              />
            ) : (
              <Typography color="error">Staff post not found</Typography>
            )}
          </Box>
        )}
        {/* Comments follow the post */}
        <PostList
          comments={comments}
          loading={loading}
          error={error}
          refresh={refresh}
          staffPostId={staffPostIdNum}
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
          bgcolor: "white",
          position: "sticky",
          bottom: 0,
          left: 0,
          zIndex: 10,
        }}
      >
        <Box sx={{ width: "100%", p: 2 }}>
          <NewPostForm
            staffPostId={staffPostIdNum}
            targetId={targetId}
            userId={userId}
            currentUser={profileUser}
            onPost={refresh}
          />
        </Box>
      </Box>
    </Box>
  );
}

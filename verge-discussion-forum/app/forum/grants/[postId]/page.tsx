"use client";
import PostList from "../../PostList";
import NewPostForm from "../../NewPostForm";
import { useComments } from "../../useComments";
import Box from "@mui/material/Box";
import { useRouter } from "next/navigation";
import Typography from "@mui/material/Typography";
import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import GrantCard from "../../../grants/GrantCard";
import React from "react";

interface Params {
  params: Promise<{ postId: string }>;
}

export default function GrantForumPage({ params }: Params) {
  const unwrappedParams = use(params);
  const postId = unwrappedParams.postId;
  const grantIdNum = Number(postId);
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

  const { comments, loading, error, refresh } = useComments(
    undefined,
    undefined,
    undefined,
    `grant:${postId}`
  );
  const router = useRouter();

  // Fetch the actual grant
  const [grant, setGrant] = useState<any>(null);
  const [grantLoading, setGrantLoading] = useState(true);
  const [grantError, setGrantError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setGrantLoading(true);
    setGrantError("");
    console.log(" Fetching grant with ID:", postId);
    fetch(`/api/grants?grantId=${postId}&contextSize=0`)
      .then((res) => res.json())
      .then((data) => {
        console.log(" Grant API response:", data);
        let foundGrant = null;
        if (data.grants && data.grants.length > 0) {
          foundGrant = data.grants[0];
          console.log(" Found grant:", foundGrant);
        } else {
          console.log(" No grants found in response");
        }
        setGrant(foundGrant);
        setGrantLoading(false);
      })
      .catch((error) => {
        console.error(" Error fetching grant:", error);
        if (!isMounted) return;
        setGrantError("Failed to load grant");
        setGrantLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [postId]);

  // Show/hide post toggle
  const [showPost, setShowPost] = useState(true);

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
          pb: 2,
        }}
      >
        {/* Back to Grants button */}
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
        {/* Grant at the top */}
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
            {grantLoading ? (
              <Typography>Loading grant...</Typography>
            ) : grantError ? (
              <Typography color="error">{grantError}</Typography>
            ) : grant ? (
              <GrantCard grant={grant} />
            ) : (
              <Typography color="error">Grant not found</Typography>
            )}
          </Box>
        )}
        <PostList
          comments={comments}
          loading={loading}
          error={error}
          refresh={refresh}
          postId={undefined}
          staffPostId={undefined}
          grantId={undefined}
          targetId={`grant:${postId}`}
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
          <NewPostForm
            grantId={postId}
            userId={userId}
            currentUser={profileUser}
            onPost={refresh}
          />
        </Box>
      </Box>
    </Box>
  );
}

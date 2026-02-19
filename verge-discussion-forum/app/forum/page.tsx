"use client";
import PostList from "./PostList";
import NewPostForm from "./NewPostForm";
import { useComments } from "./useComments";
import Box from "@mui/material/Box";
import { useSession } from "next-auth/react";
import { fetchStaffPosts, StaffPost } from "../forum_feed_page/staffPostApi";
import StaffPostCard from "../../home_feed_page/StaffPostCard";
import { useEffect, useState } from "react";
import { useCallback } from "react";

export default function ForumPage() {
  // Get URL parameters
  const [postId, setPostId] = useState<number | string | undefined>(undefined);
  const [staffPostId, setStaffPostId] = useState<number | undefined>(undefined);
  const [grantId, setGrantId] = useState<number | undefined>(undefined);

  useEffect(() => {
    // Get URL parameters from the current URL
    const urlParams = new URLSearchParams(window.location.search);
    const postIdParam = urlParams.get("postId");
    const staffPostIdParam = urlParams.get("staffPostId");
    const grantIdParam = urlParams.get("grantId");

    setPostId(postIdParam ? parseInt(postIdParam) : undefined);
    setStaffPostId(staffPostIdParam ? parseInt(staffPostIdParam) : undefined);
    setGrantId(grantIdParam ? parseInt(grantIdParam) : undefined);
  }, []);

  // Determine which field to use for comments based on the ID format
  // MongoDB papers have large numeric IDs (like 1971440513)
  // Staff posts have smaller numeric IDs (like 538703088)
  // For reposts, we need to handle string IDs
  const isMongoDBPaper =
    (typeof postId === "number" && postId > 1000000000) ||
    (staffPostId && staffPostId > 1000000000);

  // Use the appropriate field for comments
  // For reposts, use the postId (which is a string UUID)
  const commentPostId =
    typeof postId === "number"
      ? postId
      : isMongoDBPaper
        ? staffPostId
        : undefined;
  const commentStaffPostId =
    !isMongoDBPaper && !postId ? staffPostId : undefined;

  console.log(" ForumPage comment fields:", {
    postId,
    staffPostId,
    isMongoDBPaper,
    commentPostId,
    commentStaffPostId,
    postIdType: typeof postId,
    staffPostIdType: typeof staffPostId,
  });
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

  // Staff posts state
  const [staffPosts, setStaffPosts] = useState<StaffPost[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [singleStaffPost, setSingleStaffPost] = useState<StaffPost | null>(
    null
  );
  const [singleStaffLoading, setSingleStaffLoading] = useState(false);
  const [singleStaffError, setSingleStaffError] = useState<string | null>(null);

  // Get targetId from bookmark data or preview props
  const [targetId, setTargetId] = useState<string | null>(null);

  // Debug targetId changes
  useEffect(() => {
    console.log(" ForumPage targetId changed to:", targetId);
  }, [targetId]);

  // Use comments hook with targetId - only call when targetId is available
  const { comments, loading, error, refresh } = useComments(
    undefined, // Don't pass postId when using targetId
    undefined, // Don't pass staffPostId when using targetId
    grantId,
    targetId || undefined // Convert null to undefined
  );

  useEffect(() => {
    // Handle both staffPostId and postId cases
    if (staffPostId || postId) {
      let mounted = true;

      // If we have a postId that looks like a MongoDB paper (large number), construct targetId
      // This is exactly how the direct forum page works
      if (typeof postId === "number" && postId > 1000000000) {
        const constructedTargetId = `openalex:https://openalex.org/W${postId}`;
        console.log(
          ` Constructing targetId for MongoDB paper (same as direct forum page): ${constructedTargetId}`
        );
        setTargetId(constructedTargetId);
        return () => {
          mounted = false;
        };
      }

      // If we have a staffPostId, fetch the staff post data
      if (staffPostId) {
        setSingleStaffLoading(true);
        setSingleStaffError(null);

        console.log(
          ` Fetching staff post data for staffPostId: ${staffPostId}`
        );

        // Fetch the staff post data from MongoDB API first
        fetch(`/api/staff-posts/mongodb?postId=${staffPostId}&contextSize=0`)
          .then((res) => res.json())
          .then((data) => {
            if (!mounted) return;

            const staffPost =
              data.posts && data.posts.length > 0 ? data.posts[0] : null;
            setSingleStaffPost(staffPost);

            if (staffPost) {
              console.log(` Found staff post:`, staffPost);

              // Get targetId from staff post's linkId (OpenAlex ID)
              if (staffPost.linkId) {
                const targetId = staffPost.linkId;
                console.log(
                  ` Using targetId from staff post linkId: ${targetId}`
                );
                setTargetId(targetId);
              } else {
                console.log(
                  ` Staff post has no linkId, trying bookmark lookup as fallback...`
                );

                // Fallback: try to get targetId from bookmark data
                fetch(
                  `/api/mongodb/bookmarks?generatedNumericId=${staffPostId}&targetType=staff_post`
                )
                  .then((res) => res.json())
                  .then((bookmarkData) => {
                    if (!mounted) return;
                    if (
                      bookmarkData.bookmark &&
                      bookmarkData.bookmark.targetId
                    ) {
                      console.log(
                        ` Found targetId from bookmark fallback: ${bookmarkData.bookmark.targetId}`
                      );
                      setTargetId(bookmarkData.bookmark.targetId);
                    } else {
                      console.log(
                        ` No targetId found from staff post or bookmarks`
                      );
                    }
                  })
                  .catch((error) => {
                    console.error(
                      ` Error fetching bookmark fallback:`,
                      error
                    );
                  });
              }
            } else {
              console.log(` Staff post not found`);
            }

            setSingleStaffLoading(false);
          })
          .catch((error) => {
            if (!mounted) return;
            console.error(` Error fetching staff post:`, error);
            setSingleStaffError("Failed to load staff post");
            setSingleStaffLoading(false);
          });
      }

      return () => {
        mounted = false;
      };
    } else {
      let mounted = true;
      setStaffLoading(true);
      setStaffError(null);
      fetchStaffPosts(1, 10)
        .then((res) => {
          if (mounted) {
            setStaffPosts(res.posts || []);
          }
        })
        .catch((e) => {
          if (mounted) setStaffError("Failed to load staff posts");
        })
        .finally(() => {
          if (mounted) setStaffLoading(false);
        });
      return () => {
        mounted = false;
      };
    }
  }, [staffPostId, postId]);

  console.log(
    " ForumPage rendering with targetId:",
    targetId,
    "postId:",
    postId,
    "staffPostId:",
    staffPostId,
    "targetId type:",
    typeof targetId,
    "targetId truthy:",
    !!targetId
  );

  return (
    <Box
      sx={{
        bgcolor: "white",
        color: "black",
        borderRadius: 2,
        p: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Move header above scrollable area */}
      <Box sx={{ px: 2, pt: 0, pb: 0 }}>
        <h1 className="text-2xl font-bold mb-1">Discussion Forum</h1>
      </Box>
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 2,
          pt: 0.5,
          pb: 0,
          display: "flex",
          flexDirection: "column",
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
        }}
      >
        {/* Header moved out, only posts scroll */}
        <PostList
          comments={comments}
          loading={loading}
          error={error}
          refresh={refresh}
          postId={commentPostId}
          staffPostId={commentStaffPostId}
          grantId={grantId}
          targetId={targetId || undefined}
          userId={userId}
          renderInput={null}
        />
      </Box>
      {/* Static input at the bottom */}
      {targetId && (
        <Box
          sx={{
            p: 2,
            borderTop: "1px solid #eee",
            bgcolor: "white",
            position: "sticky",
            bottom: 0,
            left: 0,
            zIndex: 10,
          }}
        >
          <NewPostForm
            postId={commentPostId}
            staffPostId={commentStaffPostId}
            grantId={grantId}
            targetId={targetId}
            userId={userId}
            currentUser={profileUser}
            onPost={refresh}
          />
        </Box>
      )}
    </Box>
  );
}

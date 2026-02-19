"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import ProfileCard from "../ProfileCard";
import ProfileLayout from "../ProfileLayout";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { useSession } from "next-auth/react";
import {
  useSendConnectionRequest,
  useConnectionRequests,
  useConnections,
  useOutgoingConnectionRequests,
  useRespondToConnectionRequest,
} from "../useConnections";
import ProfileTabs from "../ProfileTabs";
import FeedCard from "../../forum/FeedCard";
import ForumPage from "../../forum/page";
import CommentPopup from "../../forum/CommentPopup";
import ClientLayout from "../../client-layout";
import AboutCard from "../AboutCard";
import LabAffiliationCard from "../LabAffiliationCard";
import CurrentProjectsCard from "../CurrentProjectsCard";import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

export default function ProfileIdPageWrapper(props: any) {
  // Remove useSession and router from wrapper
  return (
    <ClientLayout>
      <ProfileIdPage {...props} />
    </ClientLayout>
  );
}

function ProfileIdPage() {
  const router = useRouter();
  const params = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const userId = params?.id as string;
  const [activeTab, setActiveTab] = useState<"posts">("posts");
  const [reposts, setReposts] = useState<any[]>([]);
  const [repostsLoading, setRepostsLoading] = useState(false);
  const [repostsError, setRepostsError] = useState<string | null>(null);
  const [previewPostId, setPreviewPostId] = useState<string | null>(null);
  const [previewTargetId, setPreviewTargetId] = useState<string | null>(null);
  const [incomingRequestActionLoading, setIncomingRequestActionLoading] =
    useState(false);
  const [incomingRequestActionError, setIncomingRequestActionError] = useState<
    string | null
  >(null);
  const [incomingRequestAccepted, setIncomingRequestAccepted] = useState(false);
  const { respond } = useRespondToConnectionRequest();
  const {
    sendRequest,
    loading: sending,
    error: sendError,
  } = useSendConnectionRequest();
  const {
    requests,
    loading: requestsLoading,
    fetchRequests,
    error: requestsError,
  } = useConnectionRequests(session?.userId);
  const { connections, loading: connectionsLoading } = useConnections(
    session?.userId
  );
  const {
    requests: outgoingRequests,
    loading: outgoingLoading,
    fetchRequests: fetchOutgoingRequests,
  } = useOutgoingConnectionRequests(session?.userId);

  // All hooks above this line

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/profile/mongodb/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (activeTab === "posts" && userId) {
      setRepostsLoading(true);
      setRepostsError(null);
      fetch(`/api/reposts/mongodb?userId=${userId}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          // Handle different response structures
          if (data.error) {
            throw new Error(data.error);
          }
          // Ensure data is an array
          const repostsData = Array.isArray(data) ? data : data.reposts || [];
          console.log(
            " Profile page received reposts:",
            repostsData.map((r: any) => ({
              id: r.id,
              postId: r.postId,
              userId: r.userId,
            }))
          );
          setReposts(repostsData);
          setRepostsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load reposts:", err);
          setRepostsError("Failed to load posts");
          setReposts([]); // Set empty array to prevent filter errors
          setRepostsLoading(false);
        });
    }
  }, [activeTab, userId]);

  useEffect(() => {
    if (session?.userId && userId === session.userId) {
      router.replace("/profile");
    }
  }, [session, userId, router]);

  // Only after all hooks, do early returns
  if (status === "loading") return null;
  if (status === "unauthenticated") return null;

  // Only show connect button if viewing another user's profile
  const showConnect = session?.userId && userId && userId !== session.userId;

  // Determine connection state
  const isConnected = connections?.some((c) => c.id === userId);
  const isPending = outgoingRequests?.some(
    (r) =>
      r.fromUserId === session?.userId &&
      r.toUserId === userId &&
      r.status === "PENDING"
  );

  // Find if the viewed user has sent a pending request to the current user
  const incomingRequest = requests?.find(
    (r) =>
      r.fromUserId === userId &&
      r.toUserId === session?.userId &&
      r.status === "PENDING"
  );
  const showIncomingRequestActions = Boolean(showConnect && incomingRequest);

  const handleConnect = async () => {
    if (!session?.userId || !userId) return;
    await sendRequest(session.userId, userId);
    fetchOutgoingRequests();
  };

  const handleAcceptRequest = async () => {
    if (!incomingRequest || !session || !session.userId) return;
    setIncomingRequestActionLoading(true);
    setIncomingRequestActionError(null);
    try {
      await respond(userId, session.userId, "ACCEPT");
      setIncomingRequestAccepted(true);
      fetchRequests();
    } catch (e: any) {
      setIncomingRequestActionError(e.message || "Failed to accept request");
    } finally {
      setIncomingRequestActionLoading(false);
    }
  };
  const handleDenyRequest = async () => {
    if (!incomingRequest || !session || !session.userId) return;
    setIncomingRequestActionLoading(true);
    setIncomingRequestActionError(null);
    try {
      await respond(userId, session.userId, "DECLINE");
      setIncomingRequestAccepted(false);
      fetchRequests();
    } catch (e: any) {
      setIncomingRequestActionError(e.message || "Failed to deny request");
    } finally {
      setIncomingRequestActionLoading(false);
    }
  };

  return (
    <ProfileLayout>
      <Box
        sx={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          overflowY: "auto",
        }}
      >
        {loading ? (
          <CircularProgress />
        ) : profile && Object.keys(profile).length > 0 ? (
          <>
            <ProfileCard
              {...profile}
              id={profile.id}
              showConnect={showConnect && !showIncomingRequestActions}
              isConnected={isConnected || incomingRequestAccepted}
              isPending={isPending}
              onConnect={handleConnect}
              connectLoading={sending}
              connectError={sendError}
              showIncomingRequestActions={showIncomingRequestActions}
              onAcceptRequest={handleAcceptRequest}
              onDenyRequest={handleDenyRequest}
              incomingRequestLoading={incomingRequestActionLoading}
              incomingRequestError={incomingRequestActionError}
              isIncomingRequestAccepted={incomingRequestAccepted}
            />
            {/* Render AboutCard below ProfileCard if about text exists */}
            {profile?.about && <AboutCard about={profile.about} />}
            {profile?.labAffiliation && <LabAffiliationCard labAffiliation={profile.labAffiliation} />}
            {profile?.currentProjects && <CurrentProjectsCard currentProjects={profile.currentProjects} />}            {/* Only show Posts tab for other users */}
            <ProfileTabs
              activeTab={activeTab}
              onTabChange={(tab) => {
                if (tab === "posts") setActiveTab("posts");
                // Ignore 'saved' tab for other users
              }}
              showSavedTab={false}
            />
            {activeTab === "posts" && (
              <Box sx={{ width: "100%", mt: 0, px: 2 }}>
                {repostsLoading ? (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", py: 8 }}
                  >
                    <CircularProgress />
                  </Box>
                ) : repostsError ? (
                  <Box
                    sx={{ display: "flex", justifyContent: "center", py: 8 }}
                  >
                    <span style={{ color: "red" }}>{repostsError}</span>
                  </Box>
                ) : !Array.isArray(reposts) ||
                  reposts.filter((r) => r.userId === userId).length === 0 ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      py: 8,
                    }}
                  >
                    <span style={{ color: "#888" }}>No posts yet</span>
                  </Box>
                ) : (
                  reposts
                    .filter((r) => r.userId === userId && r.postId !== null)
                    .map((repost) => (
                      <FeedCard
                        key={repost.id}
                        post={{ ...repost, type: "repost" }}
                        userId={userId}
                        showBookmark={true}
                        onOpenForum={() => {
                          console.log(
                            " PROFILE PAGE - Open Forum button clicked!"
                          );
                          console.log(" Current URL:", window.location.href);
                          console.log(" Profile page repost data:", {
                            id: repost.id,
                            postId: repost.postId,
                            userId: repost.userId,
                            fullRepost: repost,
                          });
                          console.log(" FeedCard post prop:", {
                            ...repost,
                            type: "repost",
                          });
                          console.log(
                            " About to navigate to:",
                            `/forum/${repost.postId}`
                          );
                          router.push(`/forum/${repost.postId}`);
                        }}
                        onComment={() => {
                          setPreviewPostId(repost.postId);
                          // For reposts, use unique identifier instead of shared targetId
                          setPreviewTargetId(`repost:${repost.postId}`);
                        }}
                      />
                    ))
                )}
              </Box>
            )}
            {/* Right-hand side forum preview modal for forums */}
            {previewPostId && (
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
                    setPreviewPostId(null);
                    setPreviewTargetId(null);
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
                    boxShadow: isMobile
                      ? "none"
                      : "0 8px 32px rgba(0,0,0,0.18)",
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
                    <Button
                      onClick={() => {
                        setPreviewPostId(null);
                        setPreviewTargetId(null);
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
                      Close
                    </Button>
                  </Box>
                  {/* ForumPage content for the selected forum, inlined here */}
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
                      postId={
                        previewPostId ? parseInt(previewPostId) : undefined
                      }
                      targetId={previewTargetId}
                    />
                  </Box>
                </Box>
              </>
            )}
          </>
        ) : (
          <Box>No profile found.</Box>
        )}
      </Box>
    </ProfileLayout>
  );
}

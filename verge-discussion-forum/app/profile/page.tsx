"use client";
import React, { useEffect, useState } from "react";
import ProfileCard from "./ProfileCard";
import ProfileTabs from "./ProfileTabs";
import FeedCard from "../forum/FeedCard";
import { Box, CircularProgress } from "@mui/material";
import { useSession } from "next-auth/react";
import ProfileLayout from "./ProfileLayout";
import SavedContent from "../saved/SavedContent";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import {
  useConnectionRequests,
  useRespondToConnectionRequest,
} from "./useConnections";
import UserLink from "../components/UserLink";
import ForumPage from "../forum/page";
import CommentPopup from "../forum/CommentPopup";
import Badge from "@mui/material/Badge";
import ClientLayout from "../client-layout";
import { useRouter, useSearchParams } from "next/navigation";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Avatar from "@mui/material/Avatar";
import AboutCard from "./AboutCard";
import LabAffiliationCard from "./LabAffiliationCard";
import CurrentProjectsCard from "./CurrentProjectsCard";import EditProfileDialog from "./EditProfileDialog";
import NetworkFeed from "./NetworkFeed";
import { Suspense } from "react";

const TEST_USER_ID = "test-user-1";

export default function ProfilePage() {
  return (
    <ClientLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <ProfilePageInner />
      </Suspense>
    </ClientLayout>
  );
}

function ProfilePageInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "network">(
    "posts"
  );
  const [reposts, setReposts] = useState<any[]>([]);
  const [repostsLoading, setRepostsLoading] = useState(false);
  const [repostsError, setRepostsError] = useState<string | null>(null);
  const [previewPostId, setPreviewPostId] = useState<string | null>(null);
  const [previewTargetId, setPreviewTargetId] = useState<string | null>(null);
  const userId =
    session?.userId && session.userId !== "test-user-1"
      ? session.userId
      : undefined;
  const [showEditProfile, setShowEditProfile] = useState(false);
  const {
    requests,
    setRequests,
    loading: requestsLoading,
    error: requestsError,
    fetchRequests,
  } = useConnectionRequests(userId);
  const {
    respond,
    loading: respondLoading,
    error: respondError,
  } = useRespondToConnectionRequest();
  const [actionError, setActionError] = useState<string | null>(null);
  const [respondingUsers, setRespondingUsers] = useState<Set<string>>(
    new Set()
  );

  const handleRespond = async (
    fromUserId: string,
    action: "ACCEPT" | "DECLINE"
  ) => {
    setActionError(null);
    if (!session?.userId) return;

    // Add user to responding set for loading state
    setRespondingUsers((prev) => new Set(prev).add(fromUserId));

    try {
      await respond(fromUserId, session.userId, action);

      // Remove the request from local state immediately
      setRequests((prev) =>
        prev.filter((req) => req.fromUserId !== fromUserId)
      );

      // Show success message briefly
      if (action === "ACCEPT") {
        setActionError("Connection accepted!");
        setTimeout(() => setActionError(null), 2000);
      } else {
        setActionError("Request declined");
        setTimeout(() => setActionError(null), 2000);
      }

      // Refresh the requests list to ensure consistency
      fetchRequests();
    } catch (e: any) {
      setActionError(e.message || "Failed to respond");
    } finally {
      // Remove user from responding set
      setRespondingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fromUserId);
        return newSet;
      });
    }
  };
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/profile/mongodb/${userId}`)
      .then((res) => {
        if (res.status === 404) {
          setProfile(null);
          setLoading(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setProfile(data);
          // Check if required fields are missing
          const requiredFields = ["firstName", "lastName", "school"];
          const hasMissingRequiredFields = requiredFields.some(
            (field) => !data[field] || data[field].trim() === ""
          );

          if (hasMissingRequiredFields) {
            setShowEditProfile(true);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (activeTab === "posts") {
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

  const handleTabChange = (tab: "posts" | "saved" | "network") => {
    setActiveTab(tab);
  };

  // Connection requests notification logic
  const [requestsOpen, setRequestsOpen] = useState(false);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Handle URL parameter for network tab
  React.useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "network") {
      setActiveTab("network");
    }
  }, [searchParams]);

  // Early return: show loading until session is ready and userId is available
  if (status === "loading" || !userId) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100vw",
        }}
      >
        <CircularProgress size={60} thickness={4.5} color="primary" />
      </Box>
    );
  }

  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(max-width:600px)").matches;

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
          position: "relative",
          zIndex: 1, // Ensure content stays below drawer
        }}
      >
        {loading ? (
          <CircularProgress />
        ) : profile ? (
          <>
            {/* Profile Card */}
            <ProfileCard
              {...profile}
              id={profile.id}
              onProfileChange={setProfile}
              showRequestsButton={true}
              requestsCount={requests?.length || 0}
              onShowRequests={() => setRequestsOpen(true)}
              forceEditOpen={editOpen}
              setForceEditOpen={setEditOpen}
            />
            {/* Render AboutCard below ProfileCard if about text exists */}
            {profile?.about && <AboutCard about={profile.about} />}
            {profile?.labAffiliation && <LabAffiliationCard labAffiliation={profile.labAffiliation} />}
            {profile?.currentProjects && <CurrentProjectsCard currentProjects={profile.currentProjects} />}            {/* Profile Tabs */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                position: "relative",
              }}
            >
              <ProfileTabs
                activeTab={activeTab}
                onTabChange={handleTabChange}
                showNetworkTab={true}
              />
            </Box>
            {/* Content Area */}
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
                        onComment={() => {
                          console.log(
                            " PROFILE PAGE - Comment button clicked!"
                          );
                          console.log(" Comment repost data:", {
                            id: repost.id,
                            postId: repost.postId,
                            userId: repost.userId,
                          });
                          setPreviewPostId(repost.postId);
                          // For reposts, use unique identifier instead of shared targetId
                          setPreviewTargetId(`repost:${repost.postId}`);
                        }}
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
                          console.log(
                            " About to navigate to:",
                            `/forum/${repost.postId}`
                          );
                          window.location.assign(`/forum/${repost.postId}`);
                        }}
                      />
                    ))
                )}
              </Box>
            )}
            {activeTab === "saved" && (
              <Box
                sx={{ width: "100%", px: 0, ml: 0, mr: 0, maxWidth: "100%" }}
              >
                <SavedContent />
              </Box>
            )}
            {activeTab === "network" && (
              <Box sx={{ width: "100%", height: "calc(100vh - 300px)" }}>
                <NetworkFeed />
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
                    {(() => {
                      console.log(
                        " Profile page - About to render ForumPage with:",
                        { previewPostId, previewTargetId }
                      );
                      return null;
                    })()}
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
            {/* Connection Requests Modal */}
            <Dialog
              open={requestsOpen}
              onClose={() => setRequestsOpen(false)}
              maxWidth={isMobile ? "xs" : "sm"}
              fullWidth
              PaperProps={{
                sx: {
                  borderRadius: 4,
                  p: isMobile ? 1 : 2,
                  boxShadow: 8,
                  bgcolor: "#f8fafc",
                  width: isMobile ? "90%" : undefined,
                  maxWidth: isMobile ? "350px" : undefined,
                },
              }}
            >
              <DialogTitle
                sx={{
                  fontWeight: 700,
                  fontSize: isMobile ? 18 : 22,
                  textAlign: "center",
                  pb: isMobile ? 0.5 : 1,
                  pt: isMobile ? 1 : undefined,
                }}
              >
                Connection Requests
              </DialogTitle>
              <DialogContent
                dividers
                sx={{ p: isMobile ? 1.5 : 3, bgcolor: "#f8fafc" }}
              >
                {requestsLoading ? (
                  <CircularProgress />
                ) : requestsError ? (
                  <Alert severity="error">{requestsError}</Alert>
                ) : requests.length === 0 ? (
                  <Box sx={{ color: "#888", py: 2, textAlign: "center" }}>
                    No pending requests.
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: isMobile ? 1 : 2,
                    }}
                  >
                    {requests.map((req) => (
                      <Box
                        key={req.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          p: isMobile ? 1 : 2,
                          borderRadius: 3,
                          bgcolor: "#fff",
                          boxShadow: 1,
                          gap: isMobile ? 1 : 2,
                        }}
                      >
                        <UserLink
                          userId={req.fromUserId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            textDecoration: "none",
                          }}
                        >
                          <Avatar
                            sx={{
                              width: isMobile ? 32 : 40,
                              height: isMobile ? 32 : 40,
                              bgcolor: "#1976d2",
                              fontWeight: 700,
                              fontSize: isMobile ? 14 : 18,
                              mr: isMobile ? 1 : 2,
                            }}
                          >
                            {req.user?.firstName && req.user?.lastName
                              ? `${req.user.firstName[0]}${req.user.lastName[0]}`.toUpperCase()
                              : req.user?.firstName?.[0] ||
                                req.user?.lastName?.[0] ||
                                req.fromUserId[0]}
                          </Avatar>
                          <Box>
                            <Box
                              sx={{
                                fontWeight: 700,
                                fontSize: isMobile ? 14 : 16,
                                color: "#181c24",
                              }}
                            >
                              {req.user?.fullName || req.fromUserId}
                            </Box>
                            <Box
                              sx={{
                                fontSize: isMobile ? 11 : 13,
                                color: "#888",
                              }}
                            >
                              wants to connect!
                            </Box>
                          </Box>
                        </UserLink>
                        <Box sx={{ flex: 1 }} />
                        <Box
                          sx={{
                            display: "flex",
                            gap: isMobile ? 0.5 : 1,
                            flexDirection: isMobile ? "column" : "row",
                          }}
                        >
                          <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            disabled={respondingUsers.has(req.fromUserId)}
                            onClick={() =>
                              handleRespond(req.fromUserId, "ACCEPT")
                            }
                            sx={{
                              borderRadius: 999,
                              px: isMobile ? 1 : 2,
                              fontWeight: 600,
                              fontSize: isMobile ? 11 : 13,
                              minWidth: isMobile ? 60 : 80,
                              py: isMobile ? 0.25 : undefined,
                            }}
                          >
                            {respondingUsers.has(req.fromUserId)
                              ? "Accepting..."
                              : "Accept"}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            disabled={respondingUsers.has(req.fromUserId)}
                            onClick={() =>
                              handleRespond(req.fromUserId, "DECLINE")
                            }
                            sx={{
                              borderRadius: 999,
                              px: isMobile ? 1 : 2,
                              fontWeight: 600,
                              fontSize: isMobile ? 11 : 13,
                              minWidth: isMobile ? 60 : 80,
                              py: isMobile ? 0.25 : undefined,
                            }}
                          >
                            {respondingUsers.has(req.fromUserId)
                              ? "Declining..."
                              : "Decline"}
                          </Button>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
                {actionError && (
                  <Alert
                    severity={
                      actionError.includes("accepted") ||
                      actionError.includes("declined")
                        ? "success"
                        : "error"
                    }
                    sx={{ mt: 2 }}
                  >
                    {actionError}
                  </Alert>
                )}
                {respondError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {respondError}
                  </Alert>
                )}
              </DialogContent>
              <DialogActions
                sx={{ justifyContent: "center", p: isMobile ? 1 : 2 }}
              >
                <Button
                  onClick={() => setRequestsOpen(false)}
                  color="primary"
                  sx={{
                    borderRadius: 999,
                    px: isMobile ? 2 : 4,
                    fontWeight: 700,
                    fontSize: isMobile ? 12 : undefined,
                  }}
                >
                  Close
                </Button>
              </DialogActions>
            </Dialog>
          </>
        ) : (
          <Box
            sx={{
              minHeight: "100vh",
              bgcolor: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100vw",
            }}
          >
            <Typography variant="h6" color="#888">
              No profile found.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Edit Profile Dialog for missing required fields */}
      {profile && (
        <EditProfileDialog
          open={showEditProfile}
          onClose={() => setShowEditProfile(false)}
          initialValues={profile}
          onSave={(updatedProfile) => {
            setProfile(updatedProfile);
            setShowEditProfile(false);
          }}
        />
      )}
    </ProfileLayout>
  );
}

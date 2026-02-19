"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import NetworkProfileCard from "../network/NetworkProfileCard";

interface NetworkData {
  connections: any[];
  incomingRequests: any[];
  outgoingRequests: any[];
  stats: {
    totalConnections: number;
    totalIncomingRequests: number;
    totalOutgoingRequests: number;
  };
}

interface NetworkFeedProps {}

export default function NetworkFeed({}: NetworkFeedProps) {
  const { data: session, status } = useSession();
  const userId =
    status === "authenticated" && session?.userId ? session.userId : undefined;

  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [respondingUsers, setRespondingUsers] = useState<Set<string>>(
    new Set()
  );

  // Fetch network data
  const fetchNetworkData = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/network?userId=${userId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch network data");
      }

      const data = await response.json();
      setNetworkData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch network data"
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Handle accept/decline connection request
  const handleRespondToRequest = useCallback(
    async (fromUserId: string, action: "ACCEPT" | "DECLINE") => {
      if (!userId) return;

      setRespondingUsers((prev) => new Set(prev).add(fromUserId));

      try {
        const response = await fetch(
          "/api/connection-requests/mongodb/respond",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fromUserId,
              toUserId: userId,
              action,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to respond to request");
        }

        // Remove the request from local state immediately
        if (networkData) {
          setNetworkData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              incomingRequests: prev.incomingRequests.filter(
                (req) => req.id !== fromUserId
              ),
              stats: {
                ...prev.stats,
                totalIncomingRequests: prev.stats.totalIncomingRequests - 1,
              },
            };
          });
        }

        // Refresh network data to ensure consistency
        await fetchNetworkData();
      } catch (err) {
        console.error("Failed to respond to request:", err);
      } finally {
        setRespondingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(fromUserId);
          return newSet;
        });
      }
    },
    [userId, fetchNetworkData]
  );

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Initial load
  useEffect(() => {
    if (userId) {
      fetchNetworkData();
    }
  }, [userId, fetchNetworkData]);

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 800,
        mx: "auto",
        p: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3, pb: 2, borderBottom: "2px solid #e0e3e8" }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            color: "#1a1a1a",
            fontSize: { xs: "1.75rem", sm: "2.125rem" },
            mb: 2,
          }}
        >
          My Network
        </Typography>

        {/* Stats */}
        {networkData && (
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Chip
              label={`${networkData.stats.totalConnections} Connections`}
              color="primary"
              variant="outlined"
            />
            <Chip
              label={`${networkData.stats.totalIncomingRequests} Pending Requests`}
              color="secondary"
              variant="outlined"
            />
          </Box>
        )}
      </Box>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Network Content */}
      {!loading && networkData && (
        <>
          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab
                label={`Connections (${networkData.stats.totalConnections})`}
                sx={{ textTransform: "none", fontWeight: 600 }}
              />
              <Tab
                label={`Requests (${networkData.stats.totalIncomingRequests})`}
                sx={{ textTransform: "none", fontWeight: 600 }}
              />
              <Tab
                label={`Sent (${networkData.stats.totalOutgoingRequests})`}
                sx={{ textTransform: "none", fontWeight: 600 }}
              />
            </Tabs>
          </Box>

          {/* Tab Content */}
          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {activeTab === 0 && (
              <Box>
                {networkData.connections.length === 0 ? (
                  <Card sx={{ p: 4, textAlign: "center" }}>
                    <Typography
                      variant="h6"
                      color="text.secondary"
                      gutterBottom
                    >
                      No connections yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Start connecting with other researchers to build your
                      network.
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => (window.location.href = "/network")}
                      sx={{ mt: 2 }}
                    >
                      Find People to Connect With
                    </Button>
                  </Card>
                ) : (
                  networkData.connections.map((user) => (
                    <NetworkProfileCard
                      key={user.id}
                      user={user}
                      isConnected={true}
                    />
                  ))
                )}
              </Box>
            )}

            {activeTab === 1 && (
              <Box>
                {networkData.incomingRequests.length === 0 ? (
                  <Card sx={{ p: 4, textAlign: "center" }}>
                    <Typography variant="h6" color="text.secondary">
                      No pending requests
                    </Typography>
                  </Card>
                ) : (
                  networkData.incomingRequests.map((user) => (
                    <NetworkProfileCard
                      key={user.id}
                      user={user}
                      onAccept={(userId) =>
                        handleRespondToRequest(userId, "ACCEPT")
                      }
                      onDecline={(userId) =>
                        handleRespondToRequest(userId, "DECLINE")
                      }
                      responding={respondingUsers.has(user.id)}
                    />
                  ))
                )}
              </Box>
            )}

            {activeTab === 2 && (
              <Box>
                {networkData.outgoingRequests.length === 0 ? (
                  <Card sx={{ p: 4, textAlign: "center" }}>
                    <Typography variant="h6" color="text.secondary">
                      No sent requests
                    </Typography>
                  </Card>
                ) : (
                  networkData.outgoingRequests.map((user) => (
                    <NetworkProfileCard
                      key={user.id}
                      user={user}
                      isPending={true}
                    />
                  ))
                )}
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}

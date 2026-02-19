"use client";
import Box from "@mui/material/Box";
import Image from "next/image";
import ForumSidebar from "../forum_layout/ForumSidebar";
import { useSession } from "next-auth/react";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import CloseIcon from "@mui/icons-material/Close";
import { useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Avatar from "@mui/material/Avatar";
import PersonIcon from "@mui/icons-material/Person";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { signOut } from "next-auth/react";
import Drawer from "@mui/material/Drawer";
import MenuIcon from "@mui/icons-material/Menu";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ForumLayout from "../forum_layout/ForumLayout";
import NetworkProfileCard from "./NetworkProfileCard";
import NetworkFilters, {
  NetworkFilters as NetworkFiltersType,
} from "./NetworkFilters";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";

export default function NetworkClient({ userData }: { userData: any }) {
  const { data: session, status } = useSession();
  const userId =
    status === "authenticated" && session?.userId ? session.userId : undefined;
  const router = useRouter();

  // Helper to require authentication for actions
  const requireAuth = (action: () => void) => {
    if (status !== "authenticated") {
      router.push("/login");
      return;
    }
    action();
  };

  // User dropdown state and displayName logic (copied from ForumTopBar)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const isLoggedIn = status === "authenticated" && session?.user;
  const displayName = (() => {
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
    return "";
  })();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mock data for current user (this will be replaced with actual data)
  const currentUser = {
    id: userId || "unknown",
    name: displayName || "User",
  };

  // Connect page state
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [connectingUsers, setConnectingUsers] = useState<Set<string>>(
    new Set()
  );
  const [filters, setFilters] = useState<NetworkFiltersType>({
    searchTerm: "",
    school: "",
    interests: [],
    degree: "",
    status: "",
  });
  const [filterOptions, setFilterOptions] = useState({
    statusOptions: ["All"],
    schoolOptions: ["All"],
    degreeOptions: ["All"],
    interestOptions: [],
  });

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/users/filter-options");
      if (!response.ok) {
        throw new Error("Failed to fetch filter options");
      }
      const data = await response.json();
      setFilterOptions(data);
    } catch (err) {
      console.error("Failed to fetch filter options:", err);
    }
  }, []);

  // Fetch users
  const fetchUsers = useCallback(
    async (pageNum: number = 1) => {
      if (!userId) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(
          `/api/users?page=${pageNum}&limit=100&currentUserId=${userId}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        const data = await response.json();

        if (pageNum === 1) {
          setAllUsers(data.users);
        } else {
          setAllUsers((prev) => [...prev, ...data.users]);
        }

        setHasMore(data.pagination.hasNextPage);
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch users");
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  // Load more users
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchUsers(page + 1);
    }
  }, [loading, hasMore, page, fetchUsers]);

  // Handle connect request
  const handleConnect = useCallback(
    async (targetUserId: string) => {
      if (!userId) {
        router.push("/login");
        return;
      }

      setConnectingUsers((prev) => new Set(prev).add(targetUserId));

      try {
        const response = await fetch("/api/connection-requests/mongodb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromUserId: userId,
            toUserId: targetUserId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to send connection request");
        }

        // Update the user's connection status in the UI
        setAllUsers((prev) =>
          prev.map((user) =>
            user.id === targetUserId
              ? { ...user, connectionStatus: "pending" }
              : user
          )
        );
        setFilteredUsers((prev) =>
          prev.map((user) =>
            user.id === targetUserId
              ? { ...user, connectionStatus: "pending" }
              : user
          )
        );
      } catch (err) {
        console.error("Connection request failed:", err);
        // You could show a toast notification here
      } finally {
        setConnectingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(targetUserId);
          return newSet;
        });
      }
    },
    [userId, router]
  );

  // Filter users based on current filters
  useEffect(() => {
    const filtered = allUsers.filter((user) => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch =
          user.fullName.toLowerCase().includes(searchLower) ||
          user.school?.toLowerCase().includes(searchLower) ||
          user.degree?.toLowerCase().includes(searchLower) ||
          user.intendedDegree?.toLowerCase().includes(searchLower) ||
          user.about?.toLowerCase().includes(searchLower) ||
          user.researchInterests?.some((interest: any) =>
            interest.subfield.name.toLowerCase().includes(searchLower)
          );
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status && filters.status !== "All") {
        if (user.role !== filters.status) return false;
      }

      // School filter
      if (filters.school && filters.school !== "All") {
        if (user.school !== filters.school) return false;
      }

      // Degree filter
      if (filters.degree && filters.degree !== "All") {
        const userDegree = user.degree || user.intendedDegree || "";
        if (userDegree !== filters.degree) return false;
      }

      // Interests filter
      if (filters.interests.length > 0) {
        const userInterests =
          user.researchInterests?.map(
            (interest: any) => interest.subfield.name
          ) || [];
        const hasMatchingInterest = filters.interests.some((interest) =>
          userInterests.includes(interest)
        );
        if (!hasMatchingInterest) return false;
      }

      return true;
    });

    setFilteredUsers(filtered);
  }, [allUsers, filters]);

  // Handle filters change
  const handleFiltersChange = (newFilters: NetworkFiltersType) => {
    setFilters(newFilters);
  };

  // Initial load
  useEffect(() => {
    if (userId) {
      fetchUsers();
    }
    fetchFilterOptions();
  }, [userId, fetchUsers, fetchFilterOptions]);

  return (
    <ForumLayout
      userId={userId || ""}
      currentUser={currentUser}
      onCreateStaffPost={() => {
        // This will be implemented when staff functionality is added to community page
        console.log("Create staff post from community page");
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 800,
          mx: "auto",
          p: 3,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Connect Page Header with Search */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
            pb: 2,
            borderBottom: "2px solid #e0e3e8",
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 3, flex: 1 }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                color: "#1a1a1a",
                fontSize: { xs: "1.75rem", sm: "2.125rem" },
              }}
            >
              Connect
            </Typography>

            {/* Search Bar */}
            <TextField
              placeholder="Search by name, school, interests..."
              value={filters.searchTerm}
              onChange={(e) =>
                handleFiltersChange({ ...filters, searchTerm: e.target.value })
              }
              sx={{
                minWidth: { xs: 200, sm: 300 },
                maxWidth: 400,
                "& .MuiOutlinedInput-root": {
                  height: 40,
                  fontSize: "0.875rem",
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "#666", fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: filters.searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() =>
                        handleFiltersChange({ ...filters, searchTerm: "" })
                      }
                      sx={{ color: "#666" }}
                    >
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>

        {/* Filters */}
        <Box
          sx={{
            mb: isMobile ? 2 : 4, // Reduced margin on mobile
            flexShrink: 0,
            px: isMobile ? 2 : 0, // Add horizontal padding on mobile
          }}
        >
          <NetworkFilters
            onFiltersChange={handleFiltersChange}
            statusOptions={filterOptions.statusOptions}
            schoolOptions={filterOptions.schoolOptions}
            degreeOptions={filterOptions.degreeOptions}
            interestOptions={filterOptions.interestOptions}
          />
        </Box>

        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, flexShrink: 0 }}>
            {error}
          </Alert>
        )}

        {/* Scrollable Users Feed */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            mb: 8,
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              background: "#f1f1f1",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "#c1c1c1",
              borderRadius: "4px",
              "&:hover": {
                background: "#a8a8a8",
              },
            },
          }}
        >
          {filteredUsers.map((user) => (
            <NetworkProfileCard
              key={user.id}
              user={user}
              onConnect={handleConnect}
              connectLoading={connectingUsers.has(user.id)}
            />
          ))}
        </Box>

        {/* Load More Button */}
        {hasMore && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mt: 3,
              flexShrink: 0,
            }}
          >
            <Button
              variant="outlined"
              onClick={loadMore}
              disabled={loading}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
                px: 3,
                py: 1,
              }}
            >
              {loading ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={16} />
                  Loading...
                </Box>
              ) : (
                "Load More"
              )}
            </Button>
          </Box>
        )}

        {/* Empty State */}
        {!loading && filteredUsers.length === 0 && !error && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              textAlign: "center",
              p: 4,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "#666",
                mb: 2,
                fontWeight: 500,
              }}
            >
              No users found
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "#888",
                maxWidth: 400,
              }}
            >
              There are no users in the community yet.
            </Typography>
          </Box>
        )}
      </Box>
    </ForumLayout>
  );
}

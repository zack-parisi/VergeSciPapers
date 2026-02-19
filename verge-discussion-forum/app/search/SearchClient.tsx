"use client";
import Box from "@mui/material/Box";
import Image from "next/image";
import ForumSidebar from "../forum_layout/ForumSidebar";
import { useSession } from "next-auth/react";
import StaffPostCard from "../../home_feed_page/StaffPostCard";
import { useSmartPostLoading } from "../../home_feed_page/useSmartPostLoading";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CommentIcon from "@mui/icons-material/Comment";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import CloseIcon from "@mui/icons-material/Close";
import { useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
// Simple debounce function
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
import FeedCard from "../forum/FeedCard";
import { SubfieldSelector } from "./components/SubfieldSelector";
import { PostsLoader } from "./components/PostsLoader";
import { RepostsLoader } from "./components/RepostsLoader";
import { SearchFilters } from "./components/SearchFilters";
import SearchTypeSelector, {
  SearchType,
} from "./components/SearchTypeSelector";
import ForumPage from "../forum/page";
import CommentPopup from "../forum/CommentPopup";

import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Avatar from "@mui/material/Avatar";
import PersonIcon from "@mui/icons-material/Person";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { signOut } from "next-auth/react";
import Drawer from "@mui/material/Drawer";
import MenuIcon from "@mui/icons-material/Menu";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";

export default function SearchClient({
  subfields,
}: {
  subfields: { id: string; name: string }[];
}) {
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

  const [previewPostId, setPreviewPostId] = useState<number | null>(null);
  const [previewPostType, setPreviewPostType] = useState<
    "staff" | "regular" | null
  >(null);
  const [previewTargetId, setPreviewTargetId] = useState<string | null>(null);

  // Subfield selection state
  const [selectedSubfields, setSelectedSubfields] = useState<
    { id: string; name: string }[]
  >([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Journal selection state
  const [selectedJournals, setSelectedJournals] = useState<
    { id: string; name: string }[]
  >([]);

  // Search type state
  const [searchType, setSearchType] = useState<SearchType>("topics");
  const [searchValue, setSearchValue] = useState("");

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [yearRange, setYearRange] = useState<[number, number]>([
    1990,
    new Date().getFullYear(),
  ]);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(
    undefined
  );
  const [citationRange, setCitationRange] = useState<[number, number]>([
    0, 10000,
  ]);
  const [minCitations, setMinCitations] = useState(0);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Feedback state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackFullName, setFeedbackFullName] = useState("");
  const [feedbackTopic, setFeedbackTopic] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const feedbackTopics = [
    { value: "bug", label: "Bug Report" },
    { value: "improvement", label: "Improvement Suggestion" },
    { value: "complaint", label: "Complaint" },
    { value: "feature", label: "Feature Request" },
    { value: "general", label: "General Feedback" },
  ];

  const handleFeedbackClose = () => {
    setFeedbackOpen(false);
    setFeedbackFullName("");
    setFeedbackTopic("");
    setFeedbackMessage("");
    setSubmitStatus(null);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackTopic || !feedbackMessage.trim()) {
      setSubmitStatus({
        type: "error",
        message: "Please select a topic and provide feedback.",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: feedbackFullName.trim(),
          topic: feedbackTopic,
          message: feedbackMessage.trim(),
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          pathname: window.location.pathname,
        }),
      });

      if (response.ok) {
        setSubmitStatus({
          type: "success",
          message: "Thank you! Your feedback has been submitted.",
        });
        setFeedbackFullName("");
        setFeedbackTopic("");
        setFeedbackMessage("");
        setTimeout(() => {
          handleFeedbackClose();
        }, 2000);
      } else {
        throw new Error("Failed to submit feedback");
      }
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: "Failed to submit feedback. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tab change handler
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Subfield handlers
  const addSubfield = useCallback(
    (subfield: { id: string; name: string }) => {
      setSelectedSubfields((prev) => [...prev, subfield]);
      // Automatically switch to topics search type when a subfield is selected
      if (searchType !== "topics") {
        setSearchType("topics");
        // Clear journals when switching to topics
        setSelectedJournals([]);
      }
    },
    [searchType]
  );

  const removeSubfield = useCallback((subfieldId: string) => {
    setSelectedSubfields((prev) => prev.filter((s) => s.id !== subfieldId));
  }, []);

  // Journal handlers
  const addJournal = useCallback(
    (journal: { id: string; name: string }) => {
      setSelectedJournals((prev) => [...prev, journal]);
      // Automatically switch to journals search type when a journal is selected
      if (searchType !== "journals") {
        setSearchType("journals");
        // Clear subfields when switching to journals
        setSelectedSubfields([]);
      }
    },
    [searchType]
  );

  const removeJournal = useCallback((journalId: string) => {
    setSelectedJournals((prev) => prev.filter((j) => j.id !== journalId));
  }, []);

  // Filter handlers
  const handleToggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  const handleClearFilters = useCallback(() => {
    console.log(" Clearing all filters");
    setYearRange([1990, new Date().getFullYear()]);
    setCitationRange([0, 10000]);
    setMinCitations(0);
    // Trigger refetch after clearing filters
    setApplyKey((k) => k + 1);
  }, []);

  const handleYearRangeChange = useCallback((range: [number, number]) => {
    setYearRange(range);
    // Clear specific year when range changes
  }, []);

  const handleCitationRangeChange = useCallback((range: [number, number]) => {
    setCitationRange(range);
    // Update min citations to match range start
    setMinCitations(range[0]);
  }, []);

  const handleMinCitationsChange = useCallback((minCitations: number) => {
    setMinCitations(minCitations);
    // Update range start to match min citations
    setCitationRange((prev) => [minCitations, prev[1]]);
  }, []);

  // Fetch available years for the dropdown
  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        const response = await fetch("/api/papers/mongodb/metadata?type=years");
        if (response.ok) {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            setAvailableYears(
              data.data
                .map((year: string) => parseInt(year))
                .filter((year: number) => !isNaN(year))
            );
          }
        }
      } catch (error) {
        console.error("Error fetching available years:", error);
      }
    };

    fetchAvailableYears();
  }, []);

  // Comment and forum handlers (similar to home feed)
  const handleOpenForum = (postId: number | string) => {
    requireAuth(() => {
      if (typeof postId === "string") {
        // For MongoDB papers, navigate to forum page with the numeric ID
        const numericId = parseInt(postId.replace(/\D/g, ""));
        router.push(`/forum/${numericId}`);
      } else {
        // For staff posts, navigate to staff forum
        router.push(`/forum/staff/${postId}`);
      }
    });
  };

  const handleComment = (postId: number | string) => {
    console.log("handleComment called with postId:", postId);
    requireAuth(() => {
      console.log(
        "handleComment inside requireAuth, setting preview for postId:",
        postId
      );

      // Determine if this is a MongoDB paper or staff post based on the ID format
      // MongoDB papers have large numeric IDs (like 1971440513)
      // Staff posts have smaller numeric IDs (like 538703088)
      const isMongoDBPaper =
        typeof postId === "string" ||
        (typeof postId === "number" && postId > 1000000000);

      if (isMongoDBPaper) {
        // MongoDB paper - convert to a number for preview
        const numericId =
          typeof postId === "string"
            ? parseInt(postId.replace(/\D/g, ""))
            : postId;
        console.log(" Setting preview for MongoDB paper with ID:", numericId);
        setPreviewPostId(numericId);
        setPreviewPostType("regular");
        setPreviewTargetId(null);
      } else {
        // Staff post - ensure it's a number
        const numericId =
          typeof postId === "string" ? parseInt(postId, 10) : postId;
        console.log(" Setting preview for staff post with ID:", numericId);
        setPreviewPostId(numericId);
        setPreviewPostType("staff");
        setPreviewTargetId(null);
      }
    });
  };

  // Filter staff posts by selected subfields
  const selectedSubfieldNames = useMemo(
    () => selectedSubfields.map((s) => s.name),
    [selectedSubfields]
  );

  // Removed debug logging for performance optimization

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
  const [applyKey, setApplyKey] = useState(0);

  // Apply filters: trigger fetch with current filters
  const onApplyFilters = useCallback(() => {
    console.log(" Apply triggered, refetching with filters:", {
      yearRange,
      minCitations,
      subfields: selectedSubfieldNames,
    });
    setApplyKey((k) => k + 1);
  }, [yearRange, minCitations, selectedSubfieldNames]);

  return (
    <Box
      sx={{
        bgcolor: "white",
        height: "100vh",
        width: "100vw",
        py: 0,
        px: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top Bar */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: isMobile ? 0 : 4,
          height: 64,
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          bgcolor: "white",
          zIndex: 4000,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        {isMobile ? (
          <>
            {/* Hamburger (left) */}
            <IconButton
              onClick={() => setSidebarOpen(true)}
              sx={{
                position: "absolute",
                left: 8,
                top: 0,
                height: 64,
                color: "#1976d2",
              }}
              aria-label="Open navigation menu"
            >
              <MenuIcon fontSize="large" />
            </IconButton>
            {/* Centered Logo */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <Image
                src="/vergesci_logo.jpeg"
                alt="VergeSci Logo"
                width={28}
                height={28}
                style={{ borderRadius: 6, marginRight: 6 }}
              />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 20,
                  letterSpacing: 0.5,
                  color: "#000",
                }}
              >
                VergeSci
              </span>
            </Box>
            {/* User avatar/login (right) */}
            <Box
              sx={{
                position: "absolute",
                right: 8,
                top: 0,
                height: 64,
                display: "flex",
                alignItems: "center",
                zIndex: 4000,
              }}
            >
              {isLoggedIn ? (
                <>
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: "#1976d2",
                      cursor: "pointer",
                    }}
                    onClick={handleMenuOpen}
                  >
                    <PersonIcon />
                  </Avatar>
                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    PaperProps={{ sx: { minWidth: 140 } }}
                  >
                    <MenuItem
                      sx={{
                        color: "#1976d2",
                        fontWeight: 600,
                        fontSize: 16,
                        mt: 1,
                        "&:hover": {
                          backgroundColor: "#1976d2",
                          color: "white",
                        },
                      }}
                      onClick={() => {
                        handleMenuClose();
                        router.push("/profile");
                      }}
                    >
                      Profile
                    </MenuItem>
                    <MenuItem
                      sx={{
                        color: "#1976d2",
                        fontWeight: 600,
                        fontSize: 16,
                        mt: 1,
                        "&:hover": {
                          backgroundColor: "#1976d2",
                          color: "white",
                        },
                      }}
                      onClick={() => {
                        handleMenuClose();
                        signOut();
                      }}
                    >
                      Logout
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  sx={{
                    fontWeight: 700,
                    borderRadius: 2,
                    px: 2,
                    py: 0.5,
                    fontSize: 15,
                  }}
                  onClick={() => router.push("/login")}
                >
                  Login
                </Button>
              )}
            </Box>
            {/* Sidebar Drawer for mobile */}
            <Drawer
              anchor="left"
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              PaperProps={{ sx: { width: 260, maxWidth: "80vw", pt: 0 } }}
            >
              <ForumSidebar
                onCloseMobileNav={() => setSidebarOpen(false)}
                isMobile={isMobile}
                feedbackOpen={feedbackOpen}
                setFeedbackOpen={setFeedbackOpen}
              />
            </Drawer>
          </>
        ) : (
          <>
            {/* Left: VergeSci logo and text */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                minWidth: 180,
                flexShrink: 0,
              }}
            >
              <Image
                src="/vergesci_logo.jpeg"
                alt="VergeSci Logo"
                width={40}
                height={40}
                style={{ borderRadius: 8 }}
                onClick={() => router.push("/")}
              />
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 24,
                  marginLeft: 6,
                  letterSpacing: 0.5,
                  color: "#000",
                }}
              >
                VergeSci
              </span>
            </Box>
            {/* Center: Header */}
            <Typography
              variant="h4"
              sx={{
                color: "#1976d2",
                fontWeight: 700,
                textAlign: "center",
                flex: 1,
                minWidth: 0,
              }}
            >
              Find and Explore
            </Typography>
            {/* Right: User Info or Login Button */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                mr: 8,
                position: "relative",
                minWidth: 180,
                justifyContent: "flex-end",
                flexShrink: 0,
              }}
            >
              {isLoggedIn ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: "#1976d2",
                      cursor: "pointer",
                    }}
                    onClick={handleMenuOpen}
                  >
                    <PersonIcon />
                  </Avatar>
                  <Typography
                    sx={{
                      fontWeight: 600,
                      color: "#000",
                      ml: 1,
                      cursor: "pointer",
                    }}
                    onClick={handleMenuOpen}
                  >
                    {displayName}
                  </Typography>
                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                  >
                    <MenuItem
                      sx={{
                        color: "#1976d2",
                        fontWeight: 600,
                        fontSize: 16,
                        mt: 1,
                        "&:hover": {
                          backgroundColor: "#1976d2",
                          color: "white",
                        },
                      }}
                      onClick={() => {
                        handleMenuClose();
                        router.push("/profile");
                      }}
                    >
                      Profile
                    </MenuItem>
                    <MenuItem
                      sx={{
                        color: "#1976d2",
                        fontWeight: 600,
                        fontSize: 16,
                        mt: 1,
                        "&:hover": {
                          backgroundColor: "#1976d2",
                          color: "white",
                        },
                      }}
                      onClick={() => {
                        handleMenuClose();
                        signOut();
                      }}
                    >
                      Logout
                    </MenuItem>
                  </Menu>
                </Box>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  sx={{ fontWeight: 700, borderRadius: 2, ml: 2 }}
                  onClick={() => router.push("/login")}
                >
                  Login
                </Button>
              )}
            </Box>
          </>
        )}
      </Box>
      <Box sx={{ height: 64 }} /> {/* Spacer for fixed top bar */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          height: "calc(100vh - 64px)",
          width: "100vw",
        }}
      >
        {/* Sidebar */}
        {!isMobile && (
          <Box
            sx={{
              width: 260,
              minWidth: 220,
              maxWidth: 300,
              height: "100%",
              borderRight: "1.5px solid #e0e3e8",
              zIndex: 1000,
              bgcolor: "white",
            }}
          >
            <ForumSidebar />
          </Box>
        )}
        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "flex-start",
            minWidth: 0,
            bgcolor: "white",
            py: -6,
            overflowY: "auto",
            maxHeight: "calc(100vh - 64px)",
            width: "100%",
            pl: isMobile ? 0 : 0, // Ensure no left padding on mobile
            pr: isMobile ? 0 : 0, // Ensure no right padding on mobile
          }}
        >
          {/* Content Section */}
          <Box
            sx={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              width: "100%",
            }}
          >
            {/* Inline Controls: Subfield Selector + Filter Button */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                py: 1,
                borderBottom: "1px solid #e0e0e0",
                backgroundColor: "#f8f9fa",
                width: "100%",
              }}
            >
              {/* Search Type Selector */}
              <Box sx={{ flex: 1, px: isMobile ? 1 : 2 }}>
                <SearchTypeSelector
                  searchType={searchType}
                  onSearchTypeChange={setSearchType}
                  searchValue={searchValue}
                  onSearchValueChange={setSearchValue}
                  selectedSubfields={selectedSubfields}
                  onSubfieldAdd={addSubfield}
                  onSubfieldRemove={removeSubfield}
                  selectedJournals={selectedJournals}
                  onJournalAdd={addJournal}
                  onJournalRemove={removeJournal}
                />
              </Box>

              {/* Filter Toggle Button */}
              <Box sx={{ px: isMobile ? 1 : 2 }}>
                <SearchFilters
                  onApply={onApplyFilters}
                  yearRange={yearRange}
                  minCitations={minCitations}
                  onYearRangeChange={handleYearRangeChange}
                  citationRange={citationRange}
                  onCitationRangeChange={handleCitationRangeChange}
                  onMinCitationsChange={handleMinCitationsChange}
                  showFilters={showFilters}
                  onToggleFilters={handleToggleFilters}
                  onClearFilters={handleClearFilters}
                  compact={true}
                />
              </Box>
            </Box>

            {/* Search Filters Panel */}
            {(selectedSubfields.length > 0 || selectedJournals.length > 0) && (
              <Box sx={{ px: 2 }}>
                <SearchFilters
                  onApply={onApplyFilters}
                  yearRange={yearRange}
                  minCitations={minCitations}
                  onYearRangeChange={handleYearRangeChange}
                  citationRange={citationRange}
                  onCitationRangeChange={handleCitationRangeChange}
                  onMinCitationsChange={handleMinCitationsChange}
                  showFilters={showFilters}
                  onToggleFilters={handleToggleFilters}
                  onClearFilters={handleClearFilters}
                  compact={false}
                />
              </Box>
            )}

            {/* Selected Subfields Display */}
            {selectedSubfields.length > 0 && (
              <Box
                sx={{
                  width: "100%",
                  py: 1,
                  borderBottom: "1px solid #e0e0e0",
                  backgroundColor: "#f8f9fa",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    alignItems: "center",
                    px: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", mr: 1, fontWeight: 500 }}
                  >
                    Selected Topics:
                  </Typography>
                  {selectedSubfields.map((subfield) => (
                    <Chip
                      key={subfield.id}
                      label={subfield.name}
                      onDelete={() => removeSubfield(subfield.id)}
                      size="small"
                      color="primary"
                      variant="filled"
                      sx={{
                        fontSize: "0.75rem",
                        height: 28,
                        "& .MuiChip-deleteIcon": {
                          fontSize: "1rem",
                        },
                      }}
                    />
                  ))}
                  {selectedSubfields.length > 1 && (
                    <Button
                      size="small"
                      onClick={() => setSelectedSubfields([])}
                      sx={{
                        ml: 1,
                        fontSize: "0.75rem",
                        textTransform: "none",
                        color: "text.secondary",
                        "&:hover": {
                          backgroundColor: "rgba(0, 0, 0, 0.04)",
                        },
                      }}
                    >
                      Clear all
                    </Button>
                  )}
                </Box>
              </Box>
            )}

            {/* Selected Journals Display */}
            {selectedJournals.length > 0 && (
              <Box
                sx={{
                  width: "100%",
                  py: 1,
                  borderBottom: "1px solid #e0e0e0",
                  backgroundColor: "#f8f9fa",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    alignItems: "center",
                    px: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", mr: 1, fontWeight: 500 }}
                  >
                    Selected Journals:
                  </Typography>
                  {selectedJournals.map((journal) => (
                    <Chip
                      key={journal.id}
                      label={journal.name}
                      onDelete={() => removeJournal(journal.id)}
                      size="small"
                      color="primary"
                      variant="filled"
                      sx={{
                        fontSize: "0.75rem",
                        height: 28,
                        "& .MuiChip-deleteIcon": {
                          fontSize: "1rem",
                        },
                      }}
                    />
                  ))}
                  {selectedJournals.length > 1 && (
                    <Button
                      size="small"
                      onClick={() => setSelectedJournals([])}
                      sx={{
                        ml: 1,
                        fontSize: "0.75rem",
                        textTransform: "none",
                        color: "text.secondary",
                        "&:hover": {
                          backgroundColor: "rgba(0, 0, 0, 0.04)",
                        },
                      }}
                    >
                      Clear all
                    </Button>
                  )}
                </Box>
              </Box>
            )}

            {/* Tabs */}
            <Box
              sx={{ borderBottom: 1, borderColor: "divider", width: "100%" }}
            >
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                aria-label="search tabs"
                sx={{
                  px: 2,
                  "& .MuiTab-root": {
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "1rem",
                  },
                }}
              >
                <Tab label="Research Papers" />
                <Tab label="Discussion Forums" />
              </Tabs>
            </Box>

            {/* Tab Content */}
            <Box
              sx={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Papers Tab */}
              {activeTab === 0 && (
                <Box
                  sx={{
                    flex: 1,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <PostsLoader
                    selectedSubfields={selectedSubfields}
                    selectedJournals={selectedJournals}
                    searchType={searchType}
                    searchValue={searchValue}
                    applyKey={applyKey}
                    isMobile={isMobile}
                    yearRange={yearRange}
                    minCitations={minCitations}
                    userId={userId}
                    onComment={handleComment}
                    onOpenForum={handleOpenForum}
                    // Pass filter parameters
                  />
                </Box>
              )}

              {/* Forums Tab */}
              {activeTab === 1 && (
                <Box
                  sx={{
                    flex: 1,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <RepostsLoader
                    selectedSubfields={selectedSubfields}
                    isMobile={isMobile}
                    userId={userId}
                    applyKey={applyKey}
                    yearRange={yearRange}
                    minCitations={minCitations}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
      {/* Right-hand side forum preview modal */}
      {typeof previewPostId === "number" && previewPostType && (
        <>
          {/* Backdrop */}
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              bgcolor: isMobile ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.09)",
              zIndex: 2999,
              ...(isMobile && {
                backdropFilter: "blur(2px)",
              }),
            }}
            onClick={() => {
              setPreviewPostId(null);
              setPreviewPostType(null);
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
                p: isMobile ? 3 : 0,
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
                  setPreviewPostId(null);
                  setPreviewPostType(null);
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
                <CloseIcon />
              </IconButton>
            </Box>
            {/* ForumPage content for the selected post, using CommentPopup like home feed */}
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
                postId={previewPostId}
                staffPostId={
                  previewPostType === "staff" ? previewPostId : undefined
                }
                targetId={previewTargetId}
              />
            </Box>
          </Box>
        </>
      )}
      {/* Feedback Dialog */}
      <Dialog
        open={feedbackOpen}
        onClose={handleFeedbackClose}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 2,
            maxHeight: isMobile ? "100vh" : "80vh",
            zIndex: 5000,
          },
        }}
        sx={{
          zIndex: 5000,
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pb: 1,
            fontWeight: 700,
          }}
        >
          Send Feedback
          <IconButton onClick={handleFeedbackClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {submitStatus && (
              <Alert severity={submitStatus.type} sx={{ mb: 2 }}>
                {submitStatus.message}
              </Alert>
            )}

            <TextField
              label="Full Name (optional)"
              value={feedbackFullName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFeedbackFullName(e.target.value)
              }
              fullWidth
              variant="outlined"
              disabled={isSubmitting}
              placeholder="Enter your full name (optional)"
            />

            <TextField
              select
              label="Feedback Topic"
              value={feedbackTopic}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFeedbackTopic(e.target.value)
              }
              fullWidth
              variant="outlined"
              disabled={isSubmitting}
              SelectProps={{
                MenuProps: {
                  sx: {
                    zIndex: 6000, // Higher than dialog zIndex (5000)
                  },
                },
              }}
            >
              <MenuItem value="">
                <em>Select a topic</em>
              </MenuItem>
              {feedbackTopics.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Your Feedback"
              value={feedbackMessage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFeedbackMessage(e.target.value)
              }
              multiline
              rows={4}
              fullWidth
              variant="outlined"
              placeholder="Please describe your feedback in detail..."
              disabled={isSubmitting}
              inputProps={{ maxLength: 2000 }}
              helperText={`${feedbackMessage.length}/2000 characters`}
            />

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Your feedback helps us improve VergeSci. Thank you for taking the
              time to share your thoughts!
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={handleFeedbackClose}
            variant="outlined"
            disabled={isSubmitting}
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleFeedbackSubmit}
            variant="contained"
            disabled={isSubmitting || !feedbackTopic || !feedbackMessage.trim()}
            sx={{ minWidth: 100 }}
          >
            {isSubmitting ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Submit"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

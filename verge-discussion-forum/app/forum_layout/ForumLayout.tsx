"use client";
import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import ForumSidebar from "./ForumSidebar";
import ForumTopBar from "./ForumTopBar";
import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import ExploreIcon from "@mui/icons-material/Explore";
import ArticleIcon from "@mui/icons-material/Article";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import PeopleIcon from "@mui/icons-material/People";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { usePathname, useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

// MobileBlocker: blocks mobile users and shows a message
// Removed MobileBlocker function entirely

const ForumLayout: React.FC<any> = ({
  children,
  userId,
  currentUser,
  onCreateStaffPost,
  activeTab,
  onTabChange,
  tabs,
  selectedAlgorithm,
  onAlgorithmChange,
  selectedInterestsAlgorithm,
  onInterestsAlgorithmChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHamburgerDisabled, setIsHamburgerDisabled] = useState(false);

  // Feedback state - moved to ForumLayout so it persists when drawer closes
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
  const handleOpenMenu = () => setSidebarOpen(true);
  const handleCloseMenu = () => {
    setSidebarOpen(false);
    setIsHamburgerDisabled(true);
    setTimeout(() => setIsHamburgerDisabled(false), 200);
  };
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  // Define nav items (match ForumSidebar) - Eureka first as featured
  const navItems = [
    {
      label: "Eureka",
      icon: <SmartToyIcon sx={{ mr: 2 }} />,
      path: "/eureka",
    },
    {
      label: "Discover",
      icon: <ExploreIcon sx={{ mr: 2 }} />,
      path: "/home",
    },
    {
      label: "Discuss",
      icon: <ArticleIcon sx={{ mr: 2 }} />,
      path: "/forum-feed",
    },
    {
      label: "Search",
      icon: <SearchIcon sx={{ mr: 2 }} />,
      path: "/search",
    },
    {
      label: "Earn",
      icon: <AttachMoneyIcon sx={{ mr: 2 }} />,
      path: "/grants",
    },
    {
      label: "Connect",
      icon: <PeopleIcon sx={{ mr: 2 }} />,
      path: "/network",
    },
    {
      label: "Profile",
      icon: <PersonIcon sx={{ mr: 2 }} />,
      path: "/profile",
    },
  ];
  // Only show the active nav item(s)
  const activeNavItems = navItems.filter((item) => pathname === item.path);
  console.log("ForumLayout pathname:", pathname);
  console.log("ForumLayout activeNavItems:", activeNavItems);
  console.log("DEBUG: Rendering ForumTopBar with isMenuOpen:", sidebarOpen);
  return (
    <>
      {/* <MobileBlocker /> Removed: allow mobile users */}
      <Box
        sx={{
          bgcolor: "white",
          height: "100vh",
          width: "100vw",
          py: 0,
          px: 0,
          position: "relative",
          // overflow: 'hidden',
        }}
      >
        {mounted && (
          <>
            <ForumTopBar
              userId={userId}
              onHamburgerClick={handleOpenMenu}
              onCloseMenuClick={handleCloseMenu}
              isMenuOpen={sidebarOpen}
              isHamburgerDisabled={isHamburgerDisabled}
              activeTab={activeTab}
              onTabChange={onTabChange}
              tabs={tabs}
              selectedAlgorithm={selectedAlgorithm}
              onAlgorithmChange={onAlgorithmChange}
              selectedInterestsAlgorithm={selectedInterestsAlgorithm}
              onInterestsAlgorithmChange={onInterestsAlgorithmChange}
              hidePoweredBy={pathname === "/grants" || pathname === "/network"}
            />
            <Box sx={{ height: 64 }} />
            {/* Mobile Navigation Drawer - appears above everything */}
            {isMobile && (
              <Drawer
                anchor="left"
                open={sidebarOpen}
                onClose={handleCloseMenu}
                PaperProps={{
                  sx: {
                    width: 260,
                    maxWidth: "80vw",
                    pt: 0,
                    zIndex: 4000, // Highest z-index - above bottom tabs
                  },
                }}
                ModalProps={{
                  BackdropProps: {
                    sx: {
                      zIndex: 3000, // Above bottom tabs (2000) but below drawer paper (4000)
                    },
                  },
                  style: { zIndex: 3500 }, // Modal container between backdrop and paper
                }}
              >
                <ForumSidebar
                  currentUser={currentUser}
                  onCreateStaffPost={onCreateStaffPost}
                  onCloseMobileNav={handleCloseMenu}
                  isMobile={isMobile}
                  feedbackOpen={feedbackOpen}
                  setFeedbackOpen={setFeedbackOpen}
                />
              </Drawer>
            )}
          </>
        )}
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            height: "calc(100vh - 64px)",
            width: "100vw",
          }}
        >
          {/* Sidebar: only on desktop */}
          {!isMobile ? (
            <Box
              sx={{
                width: 260,
                minWidth: 220,
                maxWidth: 300,
                height: "100%",
                borderRight: "1.5px solid #e0e3e8",
                zIndex: 0,
                bgcolor: "white",
              }}
            >
              <ForumSidebar
                currentUser={currentUser}
                onCreateStaffPost={onCreateStaffPost}
                onCloseMobileNav={handleCloseMenu}
                isMobile={isMobile}
                feedbackOpen={feedbackOpen}
                setFeedbackOpen={setFeedbackOpen}
              />
            </Box>
          ) : null}
          {/* Centered Main Content */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: pathname === "/eureka" ? "stretch" : "center",
              justifyContent: "flex-start",
              minWidth: 0,
              height: "100%",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                width: "100%",
                maxWidth: pathname === "/eureka" ? "none" : 1000,
                mx: pathname === "/eureka" ? 0 : "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: pathname === "/eureka" ? "stretch" : "center",
                justifyContent: "flex-start",
                height: "100%",
              }}
            >
              {children}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Feedback Dialog - positioned outside drawer so it persists when drawer closes */}
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
    </>
  );
};

export default ForumLayout;

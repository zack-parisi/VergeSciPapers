"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Fab,
  Zoom,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Home as HomeIcon,
  Forum as ForumIcon,
  AttachMoney as GrantsIcon,
  Search as SearchIcon,
  Person as ProfileIcon,
  Add as AddIcon,
  Feedback as FeedbackIcon,
  Close as CloseIcon,
  School as FellowshipIcon,
} from "@mui/icons-material";
import { usePathname, useRouter } from "next/navigation";

interface MobileNavigationProps {
  onAddClick?: () => void;
  showAddButton?: boolean;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({
  onAddClick,
  showAddButton = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const pathname = usePathname();
  const router = useRouter();
  const [value, setValue] = useState(0);
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

  // Navigation items
  const navItems = [
    { label: "Home", icon: <HomeIcon />, path: "/home" },
    { label: "Discuss", icon: <ForumIcon />, path: "/forum-feed" },
    { label: "Grants", icon: <GrantsIcon />, path: "/grants" },
    { label: "Search", icon: <SearchIcon />, path: "/search" },
    { label: "Fellowship", icon: <FellowshipIcon />, path: "/fellowship" },
    { label: "Profile", icon: <ProfileIcon />, path: "/profile" },
    {
      label: "Feedback",
      icon: <FeedbackIcon />,
      path: "/feedback",
      isFeedback: true,
    },
  ];

  // Set initial value based on current path
  useEffect(() => {
    const currentIndex = navItems.findIndex((item) => item.path === pathname);
    if (currentIndex !== -1) {
      setValue(currentIndex);
    }
  }, [pathname]);

  const handleNavigation = (event: React.SyntheticEvent, newValue: number) => {
    const selectedItem = navItems[newValue];

    if (selectedItem.isFeedback) {
      setFeedbackOpen(true);
      return;
    }

    setValue(newValue);
    router.push(selectedItem.path);
  };

  // Show on all screen sizes for testing
  // if (!isMobile) {
  //   return null;
  // }

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

  return (
    <>
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
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pb: 1,
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            Send Feedback
          </Typography>
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
              onChange={(e) => setFeedbackFullName(e.target.value)}
              fullWidth
              variant="outlined"
              disabled={isSubmitting}
              placeholder="Enter your full name (optional)"
            />

            <TextField
              select
              label="Feedback Topic"
              value={feedbackTopic}
              onChange={(e) => setFeedbackTopic(e.target.value)}
              fullWidth
              variant="outlined"
              disabled={isSubmitting}
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
              onChange={(e) => setFeedbackMessage(e.target.value)}
              multiline
              rows={isMobile ? 6 : 4}
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

      {/* Floating Action Button for Add */}
      {showAddButton && (
        <Fab
          color="primary"
          aria-label="add"
          sx={{
            position: "fixed",
            bottom: 80,
            right: 16,
            zIndex: 1000,
            boxShadow: theme.shadows[8],
          }}
          onClick={onAddClick}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Bottom Navigation */}
      <Paper
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
        elevation={8}
      >
        <BottomNavigation
          value={value}
          onChange={handleNavigation}
          sx={{
            height: 64,
            "& .MuiBottomNavigationAction-root": {
              minWidth: "auto",
              padding: "6px 8px",
              "&.Mui-selected": {
                color: theme.palette.primary.main,
              },
            },
            "& .MuiBottomNavigationAction-label": {
              fontSize: "0.75rem",
              "&.Mui-selected": {
                fontSize: "0.75rem",
              },
            },
          }}
        >
          {navItems.map((item, index) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={item.icon}
              sx={{
                "& .MuiBottomNavigationAction-iconOnly": {
                  fontSize: "1.5rem",
                },
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </>
  );
};

export default MobileNavigation;

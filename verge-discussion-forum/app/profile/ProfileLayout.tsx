"use client";
import React, { useState } from "react";
import Box from "@mui/material/Box";
import ForumSidebar from "../forum_layout/ForumSidebar";
import ForumTopBar from "../forum_layout/ForumTopBar";
import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
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
import Button from "@mui/material/Button";

const ProfileLayout = ({ children }: { children: React.ReactNode }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const handleCloseMenu = () => setSidebarOpen(false);
  return (
    <Box
      sx={{ width: "100vw", minHeight: "100vh", bgcolor: "white", p: 0, m: 0 }}
    >
      {/* Top Header */}
      <ForumTopBar
        userId="profile-user"
        onHamburgerClick={isMobile ? () => setSidebarOpen(true) : undefined}
        isMenuOpen={sidebarOpen}
        onCloseMenuClick={handleCloseMenu}
      />
      <Box sx={{ display: "flex", flexDirection: "row", pt: "64px" }}>
        {/* Sidebar */}
        {!isMobile && (
          <Box
            sx={{
              width: 260,
              minWidth: 220,
              maxWidth: 300,
              height: "calc(100vh - 64px)",
              borderRight: "1.5px solid #e0e3e8",
              bgcolor: "white",
              zIndex: 10,
            }}
          >
            <ForumSidebar
              onCloseMobileNav={handleCloseMenu}
              isMobile={false}
              feedbackOpen={feedbackOpen}
              setFeedbackOpen={setFeedbackOpen}
            />
          </Box>
        )}
        {/* Backdrop overlay for mobile drawer */}
        {isMobile && sidebarOpen && (
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: "rgba(0, 0, 0, 0.5)",
              zIndex: 1199, // Just below drawer
              pointerEvents: "auto",
            }}
            onClick={handleCloseMenu}
          />
        )}

        {/* Drawer for mobile */}
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
                zIndex: 1200, // Ensure drawer is above content
              },
            }}
          >
            <ForumSidebar
              onCloseMobileNav={handleCloseMenu}
              isMobile={isMobile}
              feedbackOpen={feedbackOpen}
              setFeedbackOpen={setFeedbackOpen}
            />
          </Drawer>
        )}
        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            height: "calc(100vh - 64px)",
            overflow: isMobile && sidebarOpen ? "hidden" : "auto", // Prevent scrolling when drawer is open
          }}
        >
          {children}
        </Box>
      </Box>

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
};

export default ProfileLayout;

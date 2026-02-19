"use client";
import React, { useState } from "react";
import {
  Box,
  Fab,
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
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Feedback as FeedbackIcon,
  Close as CloseIcon,
} from "@mui/icons-material";

interface FeedbackBoxProps {
  position?: "mobile" | "desktop";
}

const feedbackTopics = [
  { value: "bug", label: "Bug Report" },
  { value: "improvement", label: "Improvement Suggestion" },
  { value: "complaint", label: "Complaint" },
  { value: "feature", label: "Feature Request" },
  { value: "general", label: "General Feedback" },
];

const FeedbackBox: React.FC<FeedbackBoxProps> = ({ position = "mobile" }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleOpen = () => {
    setOpen(true);
    setSubmitStatus(null);
  };

  const handleClose = () => {
    setOpen(false);
    setFullName("");
    setTopic("");
    setMessage("");
    setSubmitStatus(null);
  };

  const handleSubmit = async () => {
    if (!topic || !message.trim()) {
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
          fullName: fullName.trim(),
          topic,
          message: message.trim(),
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
        setFullName("");
        setTopic("");
        setMessage("");
        setTimeout(() => {
          handleClose();
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

  // Mobile FAB positioning
  if (position === "mobile" && isMobile) {
    return (
      <>
        <Fab
          size="medium"
          color="primary"
          aria-label="feedback"
          onClick={handleOpen}
          sx={{
            position: "fixed",
            bottom: 80, // Above bottom navigation
            left: 16,
            zIndex: 1000,
            backgroundColor: "#1976d2",
            "&:hover": {
              backgroundColor: "#1565c0",
            },
          }}
        >
          <FeedbackIcon />
        </Fab>
        <FeedbackDialog />
      </>
    );
  }

  // Desktop button in sidebar
  if (position === "desktop" && !isMobile) {
    return (
      <>
        <Button
          variant="outlined"
          startIcon={<FeedbackIcon />}
          onClick={handleOpen}
          sx={{
            mx: 2,
            mb: 2,
            borderColor: "#e0e3e8",
            color: "#666",
            fontSize: "0.875rem",
            fontWeight: 600,
            textTransform: "none",
            "&:hover": {
              borderColor: "#1976d2",
              color: "#1976d2",
              backgroundColor: "#f0f4fa",
            },
          }}
        >
          Feedback
        </Button>
        <FeedbackDialog />
      </>
    );
  }

  return null;

  function FeedbackDialog() {
    return (
      <Dialog
        open={open}
        onClose={handleClose}
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
          <IconButton onClick={handleClose} size="small">
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
              value={fullName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFullName(e.target.value)
              }
              fullWidth
              variant="outlined"
              disabled={isSubmitting}
              placeholder="Enter your full name (optional)"
            />

            <TextField
              select
              label="Feedback Topic"
              value={topic}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setTopic(e.target.value)
              }
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
              value={message}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setMessage(e.target.value)
              }
              multiline
              rows={isMobile ? 6 : 4}
              fullWidth
              variant="outlined"
              placeholder="Please describe your feedback in detail..."
              disabled={isSubmitting}
              inputProps={{ maxLength: 2000 }}
              helperText={`${message.length}/2000 characters`}
            />

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Your feedback helps us improve VergeSci. Thank you for taking the
              time to share your thoughts!
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            disabled={isSubmitting}
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={isSubmitting || !topic || !message.trim()}
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
    );
  }
};

export default FeedbackBox;

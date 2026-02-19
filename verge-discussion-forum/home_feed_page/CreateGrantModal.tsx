import React, { useState } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import InputAdornment from "@mui/material/InputAdornment";

interface GrantFormData {
  title: string;
  subfield: string;
  eligibility: string;
  description: string;
  deadline: Date | null;
  fundingAmount: string;
  grantWebsiteUrl: string;
}

interface CreateGrantModalProps {
  open: boolean;
  onClose: () => void;
  onPost: (grantData: GrantFormData) => Promise<void>;
  posting: boolean;
  error: string | null;
}

const CreateGrantModal: React.FC<CreateGrantModalProps> = ({
  open,
  onClose,
  onPost,
  posting,
  error,
}) => {
  const [formData, setFormData] = useState<GrantFormData>({
    title: "",
    subfield: "",
    eligibility: "",
    description: "",
    deadline: null,
    fundingAmount: "",
    grantWebsiteUrl: "",
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleInputChange = (field: keyof GrantFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear local error when user starts typing
    if (localError) setLocalError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setLocalError("Grant title is required");
      return false;
    }
    if (!formData.subfield.trim()) {
      setLocalError("Subfield is required");
      return false;
    }
    if (!formData.eligibility.trim()) {
      setLocalError("Eligibility criteria is required");
      return false;
    }
    if (!formData.description.trim()) {
      setLocalError("Description is required");
      return false;
    }
    if (!formData.deadline) {
      setLocalError("Deadline is required");
      return false;
    }
    if (!formData.fundingAmount.trim()) {
      setLocalError("Funding amount is required");
      return false;
    }
    if (!formData.grantWebsiteUrl.trim()) {
      setLocalError("Grant website URL is required");
      return false;
    }
    // Basic URL validation
    try {
      new URL(formData.grantWebsiteUrl);
    } catch {
      setLocalError("Please enter a valid URL");
      return false;
    }
    return true;
  };

  const handlePost = async () => {
    if (!validateForm()) return;

    setLocalError(null);
    await onPost(formData);
    // Reset form on successful post
    setFormData({
      title: "",
      subfield: "",
      eligibility: "",
      description: "",
      deadline: null,
      fundingAmount: "",
      grantWebsiteUrl: "",
    });
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          bgcolor: "rgba(0,0,0,0.7)",
          zIndex: 2100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            bgcolor: "white",
            color: "#181c24",
            borderRadius: 4,
            width: 600,
            maxWidth: "95vw",
            maxHeight: "90vh",
            p: 0,
            boxShadow: 6,
            display: "flex",
            flexDirection: "column",
            gap: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Close button */}
          <Box
            sx={{ display: "flex", justifyContent: "flex-end", p: 2, pb: 0 }}
          >
            <IconButton
              onClick={onClose}
              sx={{ color: "#888" }}
              aria-label="Close"
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Form content */}
          <Box
            sx={{
              px: 3,
              pt: 1,
              pb: 3,
              overflowY: "auto",
              maxHeight: "calc(90vh - 80px)",
            }}
          >
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, mb: 3, color: "#1976d2" }}
            >
              Post a Grant
            </Typography>

            {/* Title */}
            <TextField
              label="Title of Grant"
              variant="outlined"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              fullWidth
              disabled={posting}
              sx={{ mb: 2 }}
              InputProps={{
                sx: {
                  bgcolor: "#f5f5f5",
                  color: "#181c24",
                  borderRadius: 2,
                  fontSize: 16,
                },
              }}
            />

            {/* Subfield */}
            <TextField
              label="Subfield"
              variant="outlined"
              value={formData.subfield}
              onChange={(e) => handleInputChange("subfield", e.target.value)}
              fullWidth
              disabled={posting}
              sx={{ mb: 2 }}
              InputProps={{
                sx: {
                  bgcolor: "#f5f5f5",
                  color: "#181c24",
                  borderRadius: 2,
                  fontSize: 16,
                },
              }}
            />

            {/* Eligibility */}
            <TextField
              label="Eligibility"
              variant="outlined"
              value={formData.eligibility}
              onChange={(e) => handleInputChange("eligibility", e.target.value)}
              fullWidth
              disabled={posting}
              sx={{ mb: 2 }}
              InputProps={{
                sx: {
                  bgcolor: "#f5f5f5",
                  color: "#181c24",
                  borderRadius: 2,
                  fontSize: 16,
                },
              }}
            />

            {/* Description */}
            <TextField
              label="Description"
              variant="outlined"
              multiline
              minRows={3}
              maxRows={6}
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              fullWidth
              disabled={posting}
              sx={{ mb: 2 }}
              InputProps={{
                sx: {
                  bgcolor: "#f5f5f5",
                  color: "#181c24",
                  borderRadius: 2,
                  fontSize: 16,
                },
              }}
            />

            {/* Deadline */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Deadline"
                value={formData.deadline}
                onChange={(newValue: Date | null) =>
                  handleInputChange("deadline", newValue)
                }
                disabled={posting}
                sx={{ mb: 2, width: "100%" }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    InputProps: {
                      sx: {
                        bgcolor: "#f5f5f5",
                        color: "#181c24",
                        borderRadius: 2,
                        fontSize: 16,
                      },
                    },
                  },
                }}
              />
            </LocalizationProvider>

            {/* Funding Amount */}
            <TextField
              label="Funding Amount"
              variant="outlined"
              value={formData.fundingAmount}
              onChange={(e) =>
                handleInputChange("fundingAmount", e.target.value)
              }
              fullWidth
              disabled={posting}
              sx={{ mb: 2 }}
              placeholder="e.g., $50,000"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                ),
                sx: {
                  bgcolor: "#f5f5f5",
                  color: "#181c24",
                  borderRadius: 2,
                  fontSize: 16,
                },
              }}
            />

            {/* Grant Website URL */}
            <TextField
              label="Grant Website URL"
              variant="outlined"
              value={formData.grantWebsiteUrl}
              onChange={(e) =>
                handleInputChange("grantWebsiteUrl", e.target.value)
              }
              fullWidth
              disabled={posting}
              sx={{ mb: 2 }}
              placeholder="https://example.com/grant"
              InputProps={{
                sx: {
                  bgcolor: "#f5f5f5",
                  color: "#181c24",
                  borderRadius: 2,
                  fontSize: 16,
                },
              }}
            />

            {/* Error display */}
            {(localError || error) && (
              <Typography color="error" sx={{ mb: 2, fontSize: 15 }}>
                {localError || error}
              </Typography>
            )}

            {/* Post button */}
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                sx={{ fontWeight: 600, fontSize: 16, px: 4 }}
                onClick={handlePost}
                disabled={posting}
              >
                {posting ? "Posting..." : "Post Grant"}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default CreateGrantModal;

"use client";
import React, { useEffect, useState } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import SchoolIcon from "@mui/icons-material/School";
import InfoIcon from "@mui/icons-material/Info";

interface InstitutionEmailModalProps {
  open: boolean;
  onClose: () => void;
  action?: string; // e.g., "post comments", "create reposts"
}

const InstitutionEmailModal: React.FC<InstitutionEmailModalProps> = ({
  open,
  onClose,
  action = "interact with content",
}) => {
  const [shouldBypass, setShouldBypass] = useState(false);

  // Check if we're on the fellowship page and bypass the modal
  useEffect(() => {
    if (typeof window !== "undefined") {
      const bypass = sessionStorage.getItem("fellowship_page_bypass");
      setShouldBypass(bypass === "true");
      
      if (open && bypass === "true") {
        // Automatically close if on fellowship page
        onClose();
      }
    }
  }, [open, onClose]);

  // Don't render if bypass is active
  if (shouldBypass) {
    return null;
  }

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
            borderRadius: 3,
            p: 4,
            maxWidth: 400,
            width: "90%",
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <SchoolIcon sx={{ fontSize: 48, color: "#1976d2" }} />
          </Box>

          <Typography
            variant="h6"
            sx={{ fontWeight: 700, mb: 2, color: "#181c24" }}
          >
            Institution Email Required
          </Typography>

          <Typography
            variant="body1"
            sx={{ mb: 3, color: "#666", lineHeight: 1.5 }}
          >
            To {action}, you need to be registered with an institution email
            address (.edu).
          </Typography>

          <Box sx={{ bgcolor: "#f5f5f5", p: 2, borderRadius: 2, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
              <InfoIcon sx={{ fontSize: 20, color: "#1976d2", mr: 1 }} />
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: "#1976d2" }}
              >
                What you can do:
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{ color: "#666", fontSize: "14px" }}
            >
              • Like and save content
              <br />
              • Bookmark posts and grants
              <br />• Browse and search
            </Typography>
          </Box>

          <Button
            variant="contained"
            color="primary"
            onClick={onClose}
            sx={{
              fontWeight: 600,
              px: 4,
              py: 1.5,
              borderRadius: 2,
            }}
          >
            Got it
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default InstitutionEmailModal;

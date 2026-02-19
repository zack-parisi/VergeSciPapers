import React from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

interface ForumPreviewModalProps {
  open: boolean;
  onClose: () => void;
  postId: number | null;
  children: React.ReactNode;
}

const ForumPreviewModal: React.FC<ForumPreviewModalProps> = ({
  open,
  onClose,
  postId,
  children,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });

  if (!open || postId === null) return null;
  return (
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
        onClick={onClose}
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
          <IconButton
            onClick={onClose}
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
        {/* ForumPage content for the selected post, inlined here */}
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
          {children}
        </Box>
      </Box>
    </>
  );
};

export default ForumPreviewModal;

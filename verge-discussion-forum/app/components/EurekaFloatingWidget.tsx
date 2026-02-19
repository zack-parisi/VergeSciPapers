"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BubbleChartIcon from "@mui/icons-material/BubbleChart";
import Paper from "@mui/material/Paper";

interface EurekaFloatingWidgetProps {
  initialOpen?: boolean;
}

export default function EurekaFloatingWidget({ initialOpen = false }: EurekaFloatingWidgetProps) {
  const [open, setOpen] = useState(initialOpen);
  const router = useRouter();
  const pathname = usePathname();

  // Check for flags to open Eureka chat when navigating
  useEffect(() => {
    const checkAndOpen = () => {
      // Don't auto-open on the Eureka page itself (full page view)
      if (pathname === '/eureka') {
        return;
      }

      // Don't auto-open if popup is already open
      if (open) {
        return;
      }

      // Check for explicit flag to open (from paper card clicks)
      const shouldOpen = sessionStorage.getItem('openEurekaChat');
      if (shouldOpen === 'true') {
        setOpen(true);
        // Clear the flag after opening
        sessionStorage.removeItem('openEurekaChat');
        return;
      }

      // Check if user was actively using Eureka chat (has messages)
      const eurekaChatActive = sessionStorage.getItem('eurekaChatActive');
      const hasMessages = sessionStorage.getItem('eureka-messages');
      
      if (eurekaChatActive === 'true' && hasMessages) {
        // Auto-open popup if user was using Eureka chat and navigated to a new page
        setOpen(true);
      }
    };

    // Check on mount and when pathname changes (but not when open state changes)
    checkAndOpen();
  }, [pathname]); // Removed 'open' from dependencies to prevent re-opening after close

  return (
    <>
      {/* Floating button */}
      {!open && (
        <Tooltip title="Open Eureka" placement="left">
          <IconButton
            onClick={() => setOpen(true)}
            sx={{
              position: "fixed",
              right: 24,
              bottom: 24,
              zIndex: 2000,
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
              boxShadow: "0 8px 24px rgba(25,118,210,0.35)",
              "&:hover": {
                background: "linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)",
                boxShadow: "0 10px 28px rgba(25,118,210,0.45)",
                transform: "translateY(-1px)",
              },
            }}
         >
            <BubbleChartIcon sx={{ color: "#fff", fontSize: 28 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* Popup container */}
      {open && (
        <Paper
          elevation={6}
          sx={{
            position: "fixed",
            right: 16,
            bottom: 16,
            width: { xs: "95vw", sm: 420, md: 480 },
            height: { xs: "75vh", sm: 520, md: 560 },
            zIndex: 2100,
            borderRadius: 3,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            border: "1px solid rgba(25,118,210,0.15)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
            bgcolor: "#fff",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 1.5,
              py: 1,
              borderBottom: "1px solid #eef2f7",
              background: "linear-gradient(180deg, #ffffff 0%, #f9fbfd 100%)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                  boxShadow: "0 2px 8px rgba(25,118,210,0.3)",
                }}
              >
                <BubbleChartIcon sx={{ color: "#fff", fontSize: 18 }} />
              </Box>
              <Box sx={{ fontWeight: 700, color: "#1976d2" }}>Eureka</Box>
            </Box>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <Tooltip title="Open in full screen" placement="left">
                <IconButton 
                  size="small" 
                  onClick={() => router.push('/eureka')}
                  sx={{
                    color: "#1976d2",
                    "&:hover": {
                      bgcolor: "rgba(25, 118, 210, 0.08)",
                    },
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Close" placement="left">
                <IconButton 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    // Clear the active flag when user explicitly closes
                    // This prevents auto-opening when they navigate to other pages
                    sessionStorage.removeItem('eurekaChatActive');
                  }}
                  sx={{
                    "&:hover": {
                      bgcolor: "rgba(0, 0, 0, 0.04)",
                    },
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Iframe body */}
          <Box sx={{ flex: 1 }}>
            <iframe
              title="Eureka"
              src="/eureka/embed"
              style={{ border: "none", width: "100%", height: "100%" }}
            />
          </Box>
        </Paper>
      )}
    </>
  );
}



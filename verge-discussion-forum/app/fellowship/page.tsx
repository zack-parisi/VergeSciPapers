"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Container,
  Paper,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import ClientLayout from "../client-layout";

const FELLOWSHIP_PASSWORD = "VergeSciFellows2526!";

export default function FellowshipPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const pathname = usePathname();
  
  // Set bypass flag immediately on page load to prevent institution email checks
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        // Set a flag to bypass institution email checks on fellowship page
        window.sessionStorage.setItem("fellowship_page_bypass", "true");
      }
    } catch (e) {
      // ignore storage errors
    }
  }, []);
  
  // Persist fellowship access so users remain signed in across navigation
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const flag = localStorage.getItem("vergesci_fellowship_access");
        if (flag === "true") {
          setIsAuthenticated(true);
        }
      }
    } catch (e) {
      // ignore storage errors
    }
  }, []);

  // Prevent institution email modal from showing on fellowship page
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Close any InstitutionEmailModal that might appear
    const closeModal = () => {
      // Look for MUI Modal backdrop or content
      const modals = document.querySelectorAll('[role="presentation"]');
      modals.forEach((modal) => {
        // Check if this modal contains the institution email message
        const modalText = modal.textContent || '';
        if (modalText.includes("Institution Email Required") || 
            modalText.includes("institution email")) {
          // Try to click the "Got it" button
          const gotItButton = Array.from(modal.querySelectorAll('button')).find(
            btn => btn.textContent?.includes("Got it") || btn.textContent?.includes("Got It")
          );
          if (gotItButton) {
            (gotItButton as HTMLElement).click();
          } else {
            // If no button found, click the backdrop to close (MUI Modal closes on backdrop click)
            const backdrop = modal.querySelector('[data-testid="backdrop"]') || 
                           modal.querySelector('.MuiBackdrop-root');
            if (backdrop) {
              (backdrop as HTMLElement).click();
            }
          }
        }
      });
    };

    // Check periodically and when modal might appear
    const interval = setInterval(closeModal, 100);
    
    // Also listen for modal additions
    const observer = new MutationObserver(closeModal);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearInterval(interval);
      observer.disconnect();
      // Clean up the bypass flag when leaving the page
      try {
        window.sessionStorage.removeItem("fellowship_page_bypass");
      } catch (e) {
        // ignore
      }
    };
  }, [pathname, isAuthenticated]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === FELLOWSHIP_PASSWORD) {
      setIsAuthenticated(true);
      setError("");
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("vergesci_fellowship_access", "true");
        }
      } catch (e) {
        // ignore storage errors
      }
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  const handleApplyClick = () => {
    window.open(
      "https://docs.google.com/forms/d/e/1FAIpQLSe7q12y1gRq7k8Z1FRp4GI5x5qGh7ynaslBFi6xJtVn60ghWw/viewform?usp=dialog",
      "_blank"
    );
  };

  if (isAuthenticated) {
    return (
      <>
        <style jsx global>{`
          body {
            overflow-x: hidden !important;
            max-width: 100vw !important;
          }
          html {
            overflow-x: hidden !important;
            max-width: 100vw !important;
          }
        `}</style>
        <ClientLayout>
        <Box
          sx={{
            minHeight: "100vh",
            bgcolor: "#f8f9fa",
            py: 8,
            px: { xs: 1, sm: 2 },
            position: "relative",
            width: "100vw",
            maxWidth: "100vw",
            overflowX: "hidden",
            boxSizing: "border-box",
            margin: 0,
            paddingLeft: { xs: "8px", sm: "16px" },
            paddingRight: { xs: "8px", sm: "16px" },
          }}
        >
          {/* Logo and text in top left */}
          <Box
            sx={{
              position: "absolute",
              top: 16,
              left: 16,
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              zIndex: 1000,
            }}
            onClick={() => router.push("/home")}
          >
            <Image
              src="/vergesci_logo.jpeg"
              alt="VergeSci Logo"
              width={32}
              height={32}
              style={{ borderRadius: 8, marginRight: 8 }}
            />
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: 0.5,
                color: "#000",
              }}
            >
              VergeSci
            </Typography>
          </Box>
          {/* Sign out of Fellowship - top right */}
          <Button
            variant="outlined"
            color="primary"
            sx={{
              position: "absolute",
              top: 16,
              right: { xs: 8, sm: 16 },
              zIndex: 1000,
              fontWeight: 700,
              borderRadius: 2,
              px: { xs: 1, sm: 2 },
              py: 0.5,
              fontSize: { xs: 12, sm: 14 },
              borderWidth: 1.5,
              maxWidth: "calc(100vw - 100px)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              "&:hover": {
                borderWidth: 1.5,
                bgcolor: "rgba(25, 118, 210, 0.04)",
              },
            }}
            onClick={() => {
              try {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("vergesci_fellowship_access");
                }
              } catch (e) {
                // ignore storage errors
              }
              setIsAuthenticated(false);
            }}
          >
            Sign out of Fellowship
          </Button>
          <Box sx={{ maxWidth: "800px", mx: "auto", width: "100%", px: 0 }}>
            {/* Welcome text outside the box */}
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  color: "#1976d2",
                  mb: 2,
                  fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
                }}
              >
                Welcome VergeSci Fellows!
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: "#666",
                  fontWeight: 500,
                  lineHeight: 1.6,
                }}
              >
                Please check here for fellowship updates and resources.
              </Typography>
            </Box>
            
            <Paper
              sx={{
                p: { xs: 2, sm: 3, md: 4 },
                textAlign: "center",
                borderRadius: 4,
                boxShadow: "0 4px 32px rgba(25, 118, 210, 0.10)",
                bgcolor: "white",
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <Box sx={{ textAlign: "center", mt: 0 }}>
                {/* Upcoming Events */}
                <Box sx={{ mt: 0, pt: 0 }}>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: "#181c24",
                      mb: 2,
                    }}
                  >
                    Upcoming Events
                  </Typography>
                  <Typography variant="body1" sx={{ color: "#555" }}>
                    Information about upcoming fellowship events will be listed here.
                  </Typography>
                </Box>

                {/* Contact the team */}
                <Box sx={{ mt: 6, pt: 3, borderTop: "1px solid #e0e0e0" }}>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: "#181c24",
                      mb: 2,
                    }}
                  >
                    Contact the team
                  </Typography>
                  <Box sx={{ color: "#333" }}>
                    <Typography sx={{ mb: 0.75 }}>Ben Monahan - ben@vergesci.com</Typography>
                    <Typography sx={{ mb: 0.75 }}>Matheus Martino-Wojciechowski - matheus@vergesci.com</Typography>
                    <Typography sx={{ mb: 0.75 }}>Finley Horowitz - finley@vergesci.com</Typography>
                    <Typography>Zack Parisi - zack@vergesci.com</Typography>
                  </Box>
                </Box>

                {/* Join the Slack */}
                <Box sx={{ mt: 6, pt: 3, borderTop: "1px solid #e0e0e0" }}>
                  <Typography variant="body1" sx={{ color: "#555", mb: 2 }}>
                    Stay in touch with the other fellows and the rest of the VergeSci team!
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    sx={{ fontWeight: 700, borderRadius: 2 }}
                    onClick={() =>
                      window.open(
                        "https://vergesciworkspace.slack.com/archives/C09LYGNFM2R",
                        "_blank"
                      )
                    }
                  >
                    Join the Slack
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>
        </ClientLayout>
      </>
    );
  }

  return (
    <ClientLayout>
        <Box
          sx={{
            minHeight: "100vh",
            bgcolor: "#f8f9fa",
            py: 8,
            px: { xs: 1, sm: 2 },
            position: "relative",
            width: "100%",
            maxWidth: "100vw",
            overflowX: "hidden",
            boxSizing: "border-box",
          }}
        >
        {/* Logo and text in top left */}
        <Box
          sx={{
            position: "absolute",
            top: 16,
            left: 16,
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            zIndex: 1000,
          }}
          onClick={() => router.push("/home")}
        >
          <Image
            src="/vergesci_logo.jpeg"
            alt="VergeSci Logo"
            width={32}
            height={32}
            style={{ borderRadius: 8, marginRight: 8 }}
          />
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: 0.5,
              color: "#000",
            }}
          >
            VergeSci
          </Typography>
        </Box>
        <Box sx={{ maxWidth: "800px", mx: "auto", px: 2 }}>
          <Paper
            sx={{
              p: { xs: 3, sm: 4, md: 6 },
              textAlign: "center",
              borderRadius: 4,
              boxShadow: "0 4px 32px rgba(25, 118, 210, 0.10)",
              bgcolor: "white",
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
            }}
          >
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                color: "#1976d2",
                mb: 2,
                fontSize: { xs: "1.8rem", sm: "2.2rem", md: "2.5rem" },
              }}
            >
              The VergeSci Fellowship Page
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: "#666",
                fontWeight: 500,
                mb: 4,
                fontSize: { xs: "1rem", sm: "1.1rem" },
              }}
            >
              Please enter the password to access the fellowship page
            </Typography>

            <Box
              component="form"
              onSubmit={handlePasswordSubmit}
              sx={{
                maxWidth: 400,
                mx: "auto",
                mb: 4,
              }}
            >
              <TextField
                fullWidth
                type={showPassword ? "text" : "password"}
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                  },
                }}
                InputProps={{
                  sx: {
                    fontSize: 16,
                    py: 1,
                  },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((s) => !s)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                InputLabelProps={{
                  sx: {
                    fontSize: 16,
                  },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                sx={{
                  fontWeight: 700,
                  fontSize: 16,
                  borderRadius: 2,
                  py: 1.5,
                  boxShadow: "0 2px 8px rgba(25, 118, 210, 0.10)",
                }}
              >
                Enter
              </Button>
              {error && (
                <Typography
                  color="error"
                  sx={{
                    mt: 2,
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {error}
                </Typography>
              )}
            </Box>

            <Box sx={{ mt: 6, pt: 4, borderTop: "1px solid #e0e0e0" }}>
              <Typography
                variant="h6"
                sx={{
                  color: "#333",
                  fontWeight: 600,
                  mb: 3,
                  fontSize: { xs: "1rem", sm: "1.1rem" },
                }}
              >
                Interested in applying for the VergeSci Fellowship?
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleApplyClick}
                sx={{
                  fontWeight: 700,
                  fontSize: 16,
                  borderRadius: 2,
                  px: 4,
                  py: 1.5,
                  borderWidth: 2,
                  "&:hover": {
                    borderWidth: 2,
                    bgcolor: "rgba(25, 118, 210, 0.04)",
                  },
                }}
              >
                Apply Here
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>
    </ClientLayout>
  );
}

"use client";
import React from "react";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import PersonIcon from "@mui/icons-material/Person";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { signOut } from "next-auth/react";
import MenuIcon from "@mui/icons-material/Menu";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

interface ForumTopBarProps {
  userId: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  tabs?: { label: string; value: string }[];
  onHamburgerClick?: () => void;
  onCloseMenuClick?: () => void;
  isMenuOpen?: boolean;
  isHamburgerDisabled?: boolean;
  selectedAlgorithm?: string;
  onAlgorithmChange?: (algorithm: string) => void;
  selectedInterestsAlgorithm?: string;
  onInterestsAlgorithmChange?: (algorithm: string) => void;
  hidePoweredBy?: boolean;
}

const ForumTopBar: React.FC<ForumTopBarProps> = ({
  userId,
  activeTab = "explore",
  onTabChange,
  tabs,
  onHamburgerClick,
  onCloseMenuClick,
  isMenuOpen = false,
  isHamburgerDisabled = false,
  selectedAlgorithm = "relevance",
  onAlgorithmChange,
  selectedInterestsAlgorithm = "relevance",
  onInterestsAlgorithmChange,
  hidePoweredBy = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();
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
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [algorithmAnchorEl, setAlgorithmAnchorEl] =
    React.useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAlgorithmMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAlgorithmAnchorEl(event.currentTarget);
  };
  const handleAlgorithmMenuClose = () => {
    setAlgorithmAnchorEl(null);
  };
  const isDesktop = mounted && !isMobile;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: isDesktop ? "space-between" : "center",
        px: isDesktop ? 4 : 0,
        height: 64,
        position: "fixed",
        top: 0,
        left: 0,
        width: isDesktop ? "100%" : "100vw",

        zIndex: 1000,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)", // Safari support
        backgroundColor: "rgba(255, 255, 255, 0.9)", // Semi-transparent white
      }}
    >
      {/* Hamburger (left) and Avatar (right) for mobile, Logo/Name centered */}
      {mounted && isMobile && (
        <>
          {/* Hamburger/X button (top left) */}
          <Box
            sx={{
              position: "absolute",
              left: 16,
              top: 0,
              height: 64,
              display: "flex",
              alignItems: "center",
              zIndex: 1001,
            }}
          >
            {isMenuOpen ? (
              <Button
                key="close"
                aria-label="Close navigation menu"
                role="button"
                tabIndex={0}
                onClick={onCloseMenuClick}
                sx={{ minWidth: 0, p: 1, color: "#1976d2" }}
              >
                <CloseIcon fontSize="large" />
              </Button>
            ) : (
              <Button
                key="open"
                aria-label="Open navigation menu"
                role="button"
                tabIndex={0}
                onClick={onHamburgerClick}
                disabled={isHamburgerDisabled}
                sx={{ minWidth: 0, p: 1, color: "#1976d2" }}
              >
                <MenuIcon fontSize="large" />
              </Button>
            )}
          </Box>
          {/* Profile avatar or Login button (top right) for mobile */}
          <Box
            sx={{
              position: "absolute",
              right: 8,
              top: 0,
              height: 64,
              display: "flex",
              alignItems: "center",
              zIndex: 1001,
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
        </>
      )}
      {/* Center: Logo and name only centered for mobile */}
      {mounted && isMobile ? (
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
            style={{ borderRadius: 8, marginRight: 4 }}
          />
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: 22,
                letterSpacing: 1,
                color: "#000",
              }}
            >
              VergeSci
            </span>
            {!hidePoweredBy && (
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 6,
                  letterSpacing: 0.5,
                  color: "#888",
                  paddingBottom: 2,
                }}
              >
                Powered by OpenAlex
              </span>
            )}
          </Box>
        </Box>
      ) : (
        <>
          {/* Left: Logo and name for desktop */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Image
              src="/vergesci_logo.jpeg"
              alt="VergeSci Logo"
              width={40}
              height={40}
              style={{ borderRadius: 8, marginRight: 4 }}
              onClick={() => router.push("/")}
            />
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 24,
                  letterSpacing: 1,
                  color: "#000",
                }}
              >
                VergeSci
              </span>
              {!hidePoweredBy && (
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: 0.5,
                    color: "#888",
                    paddingBottom: 2,
                  }}
                >
                  Powered by OpenAlex
                </span>
              )}
            </Box>
          </Box>
          {/* Center: Tabs for desktop on /forum-feed and /home */}
          {(pathname === "/forum-feed" || pathname === "/home") && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              {(
                tabs || [
                  { label: "Explore", value: "explore" },
                  { label: "Research Interests", value: "interests" },
                ]
              ).map((tab) => (
                <Button
                  key={tab.value}
                  variant="text"
                  sx={{
                    fontWeight: 700,
                    fontSize: 18,
                    color: activeTab === tab.value ? "#1976d2" : "#888",
                    borderBottom:
                      activeTab === tab.value
                        ? "2px solid #1976d2"
                        : "2px solid transparent",
                    borderRadius: 0,
                    px: 3,
                    minWidth: 100,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                  }}
                  disableRipple
                  onClick={() => {
                    onTabChange && onTabChange(tab.value);
                  }}
                >
                  {tab.label}
                  {(tab.value === "explore" || tab.value === "interests") &&
                    pathname === "/home" && (
                      <Box
                        component="span"
                        onClick={(event: React.MouseEvent<HTMLElement>) => {
                          event.stopPropagation();
                          handleAlgorithmMenuOpen(event);
                        }}
                        sx={{
                          ml: 0.5,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 4px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(25, 118, 210, 0.08)",
                          border: "1px solid rgba(25, 118, 210, 0.2)",
                          transition: "all 0.2s ease",
                          "&:hover": {
                            backgroundColor: "rgba(25, 118, 210, 0.15)",
                            border: "1px solid rgba(25, 118, 210, 0.4)",
                            transform: "scale(1.05)",
                          },
                        }}
                      >
                        <KeyboardArrowDownIcon
                          sx={{ fontSize: 16, color: "#1976d2" }}
                        />
                      </Box>
                    )}
                </Button>
              ))}
            </Box>
          )}
        </>
      )}
      {/* Right: User info for desktop only */}
      {isDesktop && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mr: 8,
            position: "relative",
          }}
        >
          {/* Fellowship button */}
          <Button
            variant="outlined"
            color="primary"
            sx={{
              fontWeight: 700,
              borderRadius: 2,
              mr: 2,
              px: 2,
              py: 0.5,
              fontSize: 14,
              borderWidth: 1.5,
              "&:hover": {
                borderWidth: 1.5,
                bgcolor: "rgba(25, 118, 210, 0.04)",
              },
            }}
            onClick={() => router.push("/fellowship")}
          >
            Fellowship
          </Button>
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
                    try {
                      if (typeof window !== "undefined") {
                        localStorage.removeItem("vergesci_fellowship_access");
                      }
                    } catch (e) {
                      // ignore storage errors
                    }
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
      )}

      {/* Algorithm dropdown menu */}
      <Menu
        anchorEl={algorithmAnchorEl}
        open={Boolean(algorithmAnchorEl)}
        onClose={handleAlgorithmMenuClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <MenuItem
          sx={{
            color:
              (activeTab === "explore"
                ? selectedAlgorithm
                : selectedInterestsAlgorithm) === "relevance"
                ? "#1976d2"
                : "#000",
            fontWeight:
              (activeTab === "explore"
                ? selectedAlgorithm
                : selectedInterestsAlgorithm) === "relevance"
                ? 600
                : 400,
            fontSize: 16,
            "&:hover": {
              backgroundColor: "#f5f5f5",
            },
          }}
          onClick={() => {
            if (activeTab === "explore") {
              onAlgorithmChange && onAlgorithmChange("relevance");
            } else {
              onInterestsAlgorithmChange &&
                onInterestsAlgorithmChange("relevance");
            }
            handleAlgorithmMenuClose();
          }}
        >
          Current
        </MenuItem>
        <MenuItem
          sx={{
            color:
              (activeTab === "explore"
                ? selectedAlgorithm
                : selectedInterestsAlgorithm) === "seminal"
                ? "#1976d2"
                : "#000",
            fontWeight:
              (activeTab === "explore"
                ? selectedAlgorithm
                : selectedInterestsAlgorithm) === "seminal"
                ? 600
                : 400,
            fontSize: 16,
            "&:hover": {
              backgroundColor: "#f5f5f5",
            },
          }}
          onClick={() => {
            if (activeTab === "explore") {
              onAlgorithmChange && onAlgorithmChange("seminal");
            } else {
              onInterestsAlgorithmChange &&
                onInterestsAlgorithmChange("seminal");
            }
            handleAlgorithmMenuClose();
          }}
        >
          Seminal
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ForumTopBar;

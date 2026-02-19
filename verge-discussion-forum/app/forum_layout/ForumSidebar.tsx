"use client";

import React, { useState } from "react";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import HomeIcon from "@mui/icons-material/Home";
import ExploreIcon from "@mui/icons-material/Explore";
import ArticleIcon from "@mui/icons-material/Article";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import PersonIcon from "@mui/icons-material/Person";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import SearchIcon from "@mui/icons-material/Search";
import PeopleIcon from "@mui/icons-material/People";
import FeedbackIcon from "@mui/icons-material/Feedback";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import BubbleChartIcon from "@mui/icons-material/BubbleChart";
import Button from "@mui/material/Button";
import { useRouter, usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Badge from "@mui/material/Badge";
import { useConnectionRequests } from "../profile/useConnections";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Image from "next/image";

interface ForumSidebarProps {
  onSortPosts?: () => void;
  currentUser?: { id: string; name?: string };
  onCreateStaffPost?: () => void;
  onCloseMobileNav?: () => void;
  isMobile?: boolean;
  feedbackOpen?: boolean;
  setFeedbackOpen?: (open: boolean) => void;
}

const ForumSidebar: React.FC<ForumSidebarProps> = ({
  onSortPosts,
  currentUser,
  onCreateStaffPost,
  onCloseMobileNav,
  isMobile,
  feedbackOpen,
  setFeedbackOpen,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const userId = currentUser?.id;
  const { requests } = useConnectionRequests(userId);

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 270,
        height: "100vh",
        bgcolor: "white",
        display: "flex",
        flexDirection: "column",
        zIndex: 1200,
        boxShadow: 2,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          pt: 0, // Remove top padding to move logo to very top
        }}
      >
        {/* Company Logo and Name */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            px: 3,
            pt: 3, // Top padding for mobile status bar
            pb: 2,
            mb: 2,
            borderBottom: "1px solid #e0e3e8",
          }}
        >
          <Image
            src="/vergesci_logo.jpeg"
            alt="VergeSci Logo"
            width={32}
            height={32}
            style={{ borderRadius: 6, marginRight: 12 }}
          />
          <Typography
            variant="h6"
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

        <List sx={{ width: "100%" }}>
          {/* Eureka - Featured at the top with blue styling */}
          <ListItem
            onClick={() => router.push("/eureka")}
            sx={{
              cursor: "pointer",
              px: 2,
              py: 1.5,
              borderRadius: 0,
              transition: "all 0.3s ease",
              bgcolor: "#1976d2",
              border: "2px solid #1976d2",
              boxShadow: "0 4px 12px rgba(25, 118, 210, 0.3)",
              "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                color: "#ffffff",
              },
              "&:hover": {
                bgcolor: "#1565c0",
                border: "2px solid #1565c0",
                boxShadow: "0 6px 16px rgba(25, 118, 210, 0.4)",
                "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                  color: "#ffffff",
                },
              },
            }}
          >
            <BubbleChartIcon sx={{ color: "#ffffff", mr: 2, fontSize: 22 }} />
            <ListItemText
              primary="Eureka"
              primaryTypographyProps={{
                fontSize: 20,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: 0.5,
              }}
            />
          </ListItem>

          <ListItem
            onClick={() => router.push("/home")}
            sx={{
              cursor: "pointer",
              px: 2,
              py: 1.5,
              borderRadius: 2,
              transition: "background 0.2s",
              bgcolor: pathname === "/home" ? "#f0f4fa" : undefined,
              "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                color: pathname === "/home" ? "#1976d2" : undefined,
              },
              "&:hover": {
                bgcolor: "#f0f4fa",
                "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                  color: "#1976d2",
                },
              },
            }}
          >
            <ExploreIcon
              sx={{
                color: pathname === "/home" ? "#1976d2" : "black",
                mr: 2,
                transition: "color 0.2s",
              }}
            />
            <ListItemText
              primary="Discover"
              primaryTypographyProps={{
                fontSize: 18,
                color: pathname === "/home" ? "#1976d2" : "black",
              }}
            />
          </ListItem>
          <ListItem
            onClick={() => router.push("/forum-feed")}
            sx={{
              cursor: "pointer",
              px: 2,
              py: 1.5,
              borderRadius: 2,
              transition: "background 0.2s",
              bgcolor: pathname === "/forum-feed" ? "#f0f4fa" : undefined,
              "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                color: pathname === "/forum-feed" ? "#1976d2" : undefined,
              },
              "&:hover": {
                bgcolor: "#f0f4fa",
                "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                  color: "#1976d2",
                },
              },
            }}
          >
            <ArticleIcon
              sx={{
                color: pathname === "/forum-feed" ? "#1976d2" : "black",
                mr: 2,
                transition: "color 0.2s",
              }}
            />
            <ListItemText
              primary="Discuss"
              primaryTypographyProps={{
                fontSize: 18,
                color: pathname === "/forum-feed" ? "#1976d2" : "black",
              }}
            />
          </ListItem>
          <ListItem
            onClick={() => router.push("/search")}
            sx={{
              cursor: "pointer",
              px: 2,
              py: 1.5,
              borderRadius: 2,
              transition: "background 0.2s",
              bgcolor: pathname === "/search" ? "#f0f4fa" : undefined,
              "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                color: pathname === "/search" ? "#1976d2" : undefined,
              },
              "&:hover": {
                bgcolor: "#f0f4fa",
                "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                  color: "#1976d2",
                },
              },
            }}
          >
            <SearchIcon
              sx={{
                color: pathname === "/search" ? "#1976d2" : "black",
                mr: 2,
                transition: "color 0.2s",
              }}
            />
            <ListItemText
              primary="Search"
              primaryTypographyProps={{
                fontSize: 18,
                color: pathname === "/search" ? "#1976d2" : "black",
              }}
            />
          </ListItem>
          <ListItem
            onClick={() => router.push("/grants")}
            sx={{
              cursor: "pointer",
              px: 2,
              py: 1.5,
              borderRadius: 2,
              transition: "background 0.2s",
              bgcolor: pathname === "/grants" ? "#f0f4fa" : undefined,
              "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                color: pathname === "/grants" ? "#1976d2" : undefined,
              },
              "&:hover": {
                bgcolor: "#f0f4fa",
                "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                  color: "#1976d2",
                },
              },
            }}
          >
            <AttachMoneyIcon
              sx={{
                color: pathname === "/grants" ? "#1976d2" : "black",
                mr: 2,
                transition: "color 0.2s",
              }}
            />
            <ListItemText
              primary="Earn"
              primaryTypographyProps={{
                fontSize: 18,
                color: pathname === "/grants" ? "#1976d2" : "black",
              }}
            />
          </ListItem>
          <ListItem
            onClick={() => router.push("/network")}
            sx={{
              cursor: "pointer",
              px: 2,
              py: 1.5,
              borderRadius: 2,
              transition: "background 0.2s",
              bgcolor: pathname === "/network" ? "#f0f4fa" : undefined,
              "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                color: pathname === "/network" ? "#1976d2" : undefined,
              },
              "&:hover": {
                bgcolor: "#f0f4fa",
                "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
                  color: "#1976d2",
                },
              },
            }}
          >
            <PeopleIcon
              sx={{
                color: pathname === "/network" ? "#1976d2" : "black",
                mr: 2,
                transition: "color 0.2s",
              }}
            />
            <ListItemText
              primary="Connect"
              primaryTypographyProps={{
                fontSize: 18,
                color: pathname === "/network" ? "#1976d2" : "black",
              }}
            />
          </ListItem>

          {/* Staff-only button under Search */}
          {pathname === "/home" && currentUser?.id === "verge-staff" && (
            <ListItem disableGutters sx={{ mt: 1, mb: 1 }}>
              <Button
                variant="contained"
                color="primary"
                sx={{
                  width: "100%",
                  fontWeight: 700,
                  fontSize: 16,
                  borderRadius: 2,
                  boxShadow: 1,
                }}
                onClick={onCreateStaffPost}
              >
                Create New Staff Post
              </Button>
            </ListItem>
          )}
          {/* Grants posting button */}
          {pathname === "/grants" && currentUser?.id === "verge-staff" && (
            <ListItem disableGutters sx={{ mt: 1, mb: 1 }}>
              <Button
                variant="contained"
                color="primary"
                sx={{
                  width: "100%",
                  fontWeight: 700,
                  fontSize: 16,
                  borderRadius: 2,
                  boxShadow: 1,
                }}
                onClick={onCreateStaffPost}
              >
                Post a Grant
              </Button>
            </ListItem>
          )}
        </List>
      </Box>
      {pathname === "/saved" && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
            mt: 2,
          }}
        >
          <Button
            variant="contained"
            color="primary"
            sx={{ fontWeight: 700, fontSize: 16, borderRadius: 2 }}
            onClick={onSortPosts}
          >
            CREATE BUCKET
          </Button>
        </Box>
      )}
      {/* Feedback button above Profile */}
      <Box
        sx={{
          position: "absolute",
          bottom: 140, // Much higher above the Profile button
          left: 0,
          width: 260,
          pb: 2,
          bgcolor: "white",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Button
          onClick={() => {
            if (isMobile && onCloseMobileNav) {
              onCloseMobileNav();
              // Add a small delay to ensure nav closes before opening feedback
              setTimeout(() => {
                setFeedbackOpen?.(true);
              }, 100);
            } else {
              setFeedbackOpen?.(true);
            }
          }}
          variant="outlined"
          color="primary"
          sx={{
            borderRadius: 999,
            px: 3,
            py: 1.5,
            fontWeight: 700,
            fontSize: 16,
            width: "70%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
            letterSpacing: 0.5,
            textTransform: "none",
            gap: 1,
            borderWidth: 2,
            "&:hover": {
              borderWidth: 2,
              bgcolor: "rgba(25, 118, 210, 0.04)",
            },
          }}
        >
          <FeedbackIcon sx={{ fontSize: 20 }} />
          Feedback
        </Button>
      </Box>

      {/* Move Profile button to the bottom */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 260,
          pb: 8,
          bgcolor: "white",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Button
          onClick={() => router.push("/profile")}
          variant="contained"
          color="primary"
          sx={{
            borderRadius: 999,
            px: 3,
            py: 1.5,
            fontSize: 18,
            boxShadow: 2,
            width: "70%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            minHeight: 48,
            letterSpacing: 0.5,
            textTransform: "none",
            gap: 1,
            bgcolor: "#1976d2 !important",
            color: "#fff !important",
            "&:hover": {
              bgcolor: "#1251a3 !important",
              color: "#fff !important",
            },
          }}
          startIcon={<PersonIcon sx={{ color: "#fff", fontSize: 26 }} />}
        >
          <Box component="span" sx={{ color: "#fff" }}>
            Profile
          </Box>
          {/* Notification badge at far right, vertically centered */}
          <Badge
            color="error"
            variant="dot"
            invisible={!(requests && requests.length > 0)}
            sx={{
              position: "absolute",
              right: 18,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 10,
              "& .MuiBadge-dot": {
                backgroundColor: "#fff",
                border: "2px solid #d32f2f",
              },
            }}
          />
        </Button>
      </Box>
    </Box>
  );
};

export default ForumSidebar;

import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
// import { useRouter } from "next/navigation";

interface ProfileTabsProps {
  activeTab: "posts" | "saved" | "network";
  onTabChange: (tab: "posts" | "saved" | "network") => void;
  showSavedTab?: boolean;
  showNetworkTab?: boolean;
}

const ProfileTabs: React.FC<ProfileTabsProps> = ({
  activeTab,
  onTabChange,
  showSavedTab = true,
  showNetworkTab = false,
}) => {
  // const router = useRouter();

  // const handleSavedClick = () => {
  //   router.push("/saved");
  // };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        borderTop: "1px solid #e0e0e0",
        borderBottom: "1px solid #e0e0e0",
        bgcolor: "white",
        mt: 3,
      }}
    >
      <Box
        sx={{
          display: "flex",
          maxWidth: 600,
          width: "100%",
        }}
      >
        <Button
          onClick={() => onTabChange("posts")}
          sx={{
            flex: 1,
            py: 2,
            px: 3,
            borderRadius: 0,
            borderBottom:
              activeTab === "posts"
                ? "2px solid #1976d2"
                : "2px solid transparent",
            color: activeTab === "posts" ? "#1976d2" : "#666",
            fontWeight: activeTab === "posts" ? 600 : 400,
            textTransform: "none",
            fontSize: 16,
            "&:hover": {
              bgcolor: "#f5f5f5",
            },
          }}
        >
          Posts
        </Button>
        {showSavedTab && (
          <Button
            onClick={() => onTabChange("saved")}
            sx={{
              flex: 1,
              py: 2,
              px: 3,
              borderRadius: 0,
              borderBottom:
                activeTab === "saved"
                  ? "2px solid #1976d2"
                  : "2px solid transparent",
              color: activeTab === "saved" ? "#1976d2" : "#666",
              fontWeight: activeTab === "saved" ? 600 : 400,
              textTransform: "none",
              fontSize: 16,
              "&:hover": {
                bgcolor: "#f5f5f5",
              },
            }}
          >
            Saved
          </Button>
        )}
        {showNetworkTab && (
          <Button
            onClick={() => onTabChange("network")}
            sx={{
              flex: 1,
              py: 2,
              px: 3,
              borderRadius: 0,
              borderBottom:
                activeTab === "network"
                  ? "2px solid #1976d2"
                  : "2px solid transparent",
              color: activeTab === "network" ? "#1976d2" : "#666",
              fontWeight: activeTab === "network" ? 600 : 400,
              textTransform: "none",
              fontSize: 16,
              "&:hover": {
                bgcolor: "#f5f5f5",
              },
            }}
          >
            Network
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default ProfileTabs;

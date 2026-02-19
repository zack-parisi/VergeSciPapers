import React from "react";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import PersonIcon from "@mui/icons-material/Person";
import SchoolIcon from "@mui/icons-material/School";
import WorkIcon from "@mui/icons-material/Work";
import Chip from "@mui/material/Chip";
import { useRouter } from "next/navigation";

interface NetworkProfileCardProps {
  user: {
    id: string;
    fullName: string;
    role: string;
    school?: string;
    degree?: string;
    intendedDegree?: string;
    about?: string;
    email?: string;
    connectionStatus?: "none" | "pending" | "connected" | "received";
    researchInterests?: Array<
      | {
          subfield?: {
            id: number;
            name: string;
          };
          name?: string;
          topic_name?: string;
          id?: string | number;
          _id?: string | number;
        }
      | string
    >;
  };
  onConnect?: (userId: string) => void;
  onAccept?: (userId: string) => void;
  onDecline?: (userId: string) => void;
  isConnected?: boolean;
  isPending?: boolean;
  connectLoading?: boolean;
  responding?: boolean;
}

const NetworkProfileCard: React.FC<NetworkProfileCardProps> = ({
  user,
  onConnect,
  onAccept,
  onDecline,
  isConnected = false,
  isPending = false,
  connectLoading = false,
  responding = false,
}) => {
  const router = useRouter();

  const handleConnect = () => {
    if (onConnect) {
      onConnect(user.id);
    }
  };

  const handleNameClick = () => {
    router.push(`/profile/${user.id}`);
  };

  return (
    <Card
      sx={{
        width: "100%",
        mb: 2,
        borderRadius: 2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        transition: "box-shadow 0.2s ease-in-out",
        "&:hover": {
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          {/* Avatar */}
          <Avatar
            sx={{
              width: 60,
              height: 60,
              bgcolor: "#1976d2",
              fontSize: "1.5rem",
              fontWeight: 600,
            }}
          >
            {user.fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </Avatar>

          {/* User Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Name and Role */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography
                variant="h6"
                onClick={handleNameClick}
                sx={{
                  fontWeight: 700,
                  color: "#1a1a1a",
                  fontSize: "1.1rem",
                  cursor: "pointer",
                  "&:hover": {
                    color: "#1976d2",
                    textDecoration: "underline",
                  },
                  transition: "color 0.2s ease-in-out",
                }}
              >
                {user.fullName}
              </Typography>
              <Chip
                label={user.role}
                size="small"
                sx={{
                  bgcolor: "#f0f4fa",
                  color: "#1976d2",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                }}
              />
            </Box>

            {/* School */}
            {user.school && (
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}
              >
                <SchoolIcon sx={{ fontSize: 16, color: "#666" }} />
                <Typography
                  variant="body2"
                  sx={{ color: "#666", fontSize: "0.875rem" }}
                >
                  {user.school}
                </Typography>
              </Box>
            )}

            {/* Degree/Intended Degree */}
            {(user.degree || user.intendedDegree) && (
              <Typography
                variant="body2"
                sx={{
                  color: "#666",
                  fontSize: "0.875rem",
                  ml: 3,
                  mb: 1,
                }}
              >
                {user.degree || user.intendedDegree}
              </Typography>
            )}

            {/* About */}
            {user.about && (
              <Typography
                variant="body2"
                sx={{
                  color: "#444",
                  fontSize: "0.875rem",
                  lineHeight: 1.4,
                  mb: 2,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {user.about}
              </Typography>
            )}

            {/* Research Interests */}
            {user.researchInterests && user.researchInterests.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: "#666",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    mb: 1,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Research Interests
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {user.researchInterests.slice(0, 5).map((interest, index) => {
                    // Handle different data structures
                    let interestName: string;
                    let interestId: string | number;

                    if (typeof interest === "string") {
                      interestName = interest;
                      interestId = index;
                    } else {
                      interestName =
                        interest.subfield?.name ||
                        interest.name ||
                        interest.topic_name ||
                        "Unknown Interest";
                      interestId =
                        interest.subfield?.id ||
                        interest.id ||
                        interest._id ||
                        index;
                    }

                    return (
                      <Chip
                        key={interestId}
                        label={interestName}
                        size="small"
                        sx={{
                          bgcolor: "#f0f4fa",
                          color: "#1976d2",
                          fontWeight: 500,
                          fontSize: "0.7rem",
                          height: 20,
                        }}
                      />
                    );
                  })}
                  {user.researchInterests.length > 5 && (
                    <Chip
                      label={`+${user.researchInterests.length - 5} more`}
                      size="small"
                      sx={{
                        bgcolor: "#f5f5f5",
                        color: "#666",
                        fontWeight: 500,
                        fontSize: "0.7rem",
                        height: 20,
                      }}
                    />
                  )}
                </Box>
              </Box>
            )}

            {/* Connect/Accept/Decline Buttons */}
            {user.connectionStatus === "received" && onAccept && onDecline ? (
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => onAccept(user.id)}
                  disabled={responding}
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                    px: 2,
                    py: 0.5,
                  }}
                >
                  {responding ? "Accepting..." : "Accept"}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onDecline(user.id)}
                  disabled={responding}
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                    px: 2,
                    py: 0.5,
                  }}
                >
                  {responding ? "Declining..." : "Decline"}
                </Button>
              </Box>
            ) : onConnect && user.connectionStatus !== "connected" ? (
              <Button
                variant={
                  user.connectionStatus === "pending" ? "outlined" : "contained"
                }
                color="primary"
                size="small"
                onClick={handleConnect}
                disabled={connectLoading || user.connectionStatus === "pending"}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 600,
                  px: 2,
                  py: 0.5,
                }}
              >
                {connectLoading
                  ? "Connecting..."
                  : user.connectionStatus === "pending"
                    ? "Request Sent"
                    : "Connect"}
              </Button>
            ) : null}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default NetworkProfileCard;

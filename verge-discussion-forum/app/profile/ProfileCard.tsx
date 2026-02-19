import React, { useState } from "react";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import EditProfileDialog from "./EditProfileDialog";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import MyNetworkModal from "./MyNetworkModal";

export interface ProfileCardProps {
  profileImageUrl?: string;
  firstName?: string;
  lastName?: string;
  school?: string;
  degree?: string;

  about?: string;
  labAffiliation?: string;
  currentProjects?: string;  student?: boolean;
  intendedDegree?: string;
  onProfileChange?: (profile: ProfileCardProps) => void;
  id?: string;
  showConnect?: boolean;
  isConnected?: boolean;
  isPending?: boolean;
  onConnect?: () => void;
  connectLoading?: boolean;
  connectError?: string | null;
  showRequestsButton?: boolean;
  requestsCount?: number;
  onShowRequests?: () => void;
  forceEditOpen?: boolean;
  setForceEditOpen?: (open: boolean) => void;
  undergraduateStudent?: boolean;
  graduateStudent?: boolean;
  researchTechnician?: boolean;
  postdoctoralScholar?: boolean;
  principalInvestigator?: boolean;
  industryProfessional?: boolean;
  medicalStudent?: boolean;
  resident?: boolean;
  physician?: boolean;
  clinician?: boolean;
  otherRole?: boolean;
  showIncomingRequestActions?: boolean;
  onAcceptRequest?: () => void;
  onDenyRequest?: () => void;
  incomingRequestLoading?: boolean;
  incomingRequestError?: string | null;
  isIncomingRequestAccepted?: boolean;
}

const ProfileCard: React.FC<ProfileCardProps> = (props) => {
  const {
    profileImageUrl,
    firstName,
    lastName,
    school,
    degree,
    about,
    labAffiliation,
    currentProjects,    student,
    intendedDegree,
    onProfileChange,
    id,
    showConnect,
    isConnected,
    isPending,
    onConnect,
    connectLoading,
    connectError,
    showRequestsButton,
    requestsCount,
    onShowRequests,
    forceEditOpen,
    setForceEditOpen,
    undergraduateStudent,
    graduateStudent,
    researchTechnician,
    postdoctoralScholar,
    principalInvestigator,
    industryProfessional,
    medicalStudent,
    resident,
    physician,
    clinician,
    otherRole,
    showIncomingRequestActions,
    onAcceptRequest,
    onDenyRequest,
    incomingRequestLoading,
    incomingRequestError,
    isIncomingRequestAccepted,
  } = props;
  const [editOpen, setEditOpen] = useState(false);
  const isEditOpen =
    typeof forceEditOpen === "boolean" ? forceEditOpen : editOpen;
  const handleEditOpen = () => {
    if (setForceEditOpen) setForceEditOpen(true);
    else setEditOpen(true);
  };
  const handleEditClose = () => {
    if (setForceEditOpen) setForceEditOpen(false);
    else setEditOpen(false);
  };
  const [networkOpen, setNetworkOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"), { noSsr: true });
  return (
    <Box
      sx={{
        pt: isMobile ? 3 : 6,
        width: isMobile ? "calc(100vw - 32px)" : 900,
        maxWidth: isMobile ? "calc(100vw - 32px)" : 900,
        minWidth: isMobile ? 0 : undefined,
        bgcolor: "#e3f0fd",
        borderRadius: isMobile ? 0 : 4,
        boxShadow: "0 2px 16px rgba(25, 118, 210, 0.08)",
        border: "1.5px solid #b6d0ee",
        p: isMobile ? 1.5 : 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        mx: isMobile ? 2 : "auto",
        gap: isMobile ? 1 : 0,
        zIndex: 1,
        position: "relative",
        overflowX: isMobile ? "hidden" : undefined,
      }}
    >
      {/* Top right: Accept/Deny request buttons if incoming request, else Connect/Edit */}
      {showIncomingRequestActions ? (
        <>
          {/* Mobile: Buttons above avatar, centered */}
          {isMobile && (
            <Box
              sx={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                gap: 1,
                mb: 2,
              }}
            >
              {isIncomingRequestAccepted ? (
                <Button variant="contained" color="primary" disabled>
                  Connected
                </Button>
              ) : (
                <>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={incomingRequestLoading}
                    onClick={onAcceptRequest}
                    sx={{
                      minWidth: 120,
                      fontWeight: 600,
                      fontSize: 12,
                      px: 1.5,
                      py: 0.5,
                    }}
                  >
                    {incomingRequestLoading ? "Loading..." : "Accept"}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    disabled={incomingRequestLoading}
                    onClick={onDenyRequest}
                    sx={{
                      minWidth: 120,
                      fontWeight: 600,
                      fontSize: 12,
                      px: 1.5,
                      py: 0.5,
                    }}
                  >
                    {incomingRequestLoading ? "Loading..." : "Deny"}
                  </Button>
                </>
              )}
              {incomingRequestError && (
                <Alert severity="error" sx={{ mt: 1, width: "100%" }}>
                  {incomingRequestError}
                </Alert>
              )}
            </Box>
          )}

          {/* Desktop: Buttons in top-right corner */}
          {!isMobile && (
            <Box
              sx={{
                position: "absolute",
                top: 16,
                right: 16,
                zIndex: 3100,
                display: "flex",
                gap: 1,
              }}
            >
              {isIncomingRequestAccepted ? (
                <Button variant="contained" color="primary" disabled>
                  Connected
                </Button>
              ) : (
                <>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={incomingRequestLoading}
                    onClick={onAcceptRequest}
                    sx={{
                      minWidth: 120,
                      fontWeight: 600,
                      fontSize: 15,
                    }}
                  >
                    {incomingRequestLoading ? "Loading..." : "Accept"}
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    disabled={incomingRequestLoading}
                    onClick={onDenyRequest}
                    sx={{
                      minWidth: 120,
                      fontWeight: 600,
                      fontSize: 15,
                    }}
                  >
                    {incomingRequestLoading ? "Loading..." : "Deny"}
                  </Button>
                </>
              )}
              {incomingRequestError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {incomingRequestError}
                </Alert>
              )}
            </Box>
          )}
        </>
      ) : showConnect ? (
        <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 3100 }}>
          <Button
            variant={isConnected ? "contained" : "outlined"}
            color={isConnected ? "success" : isPending ? "warning" : "primary"}
            disabled={isConnected || isPending || connectLoading}
            onClick={onConnect}
            sx={{
              minWidth: 120,
              fontWeight: 600,
              fontSize: isMobile ? 13 : 15,
            }}
          >
            {connectLoading
              ? "Loading..."
              : isConnected
                ? "Connected"
                : isPending
                  ? "Pending"
                  : "Connect"}
          </Button>
          {connectError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {connectError}
            </Alert>
          )}
        </Box>
      ) : (
        <IconButton
          sx={{ position: "absolute", top: 16, right: 16, zIndex: 3100 }}
          onClick={handleEditOpen}
          aria-label="Edit Profile"
        >
          <EditIcon />
        </IconButton>
      )}

      {/* Main profile content - always rendered */}
      {/* Top Row: Avatar + Main Info */}
      <Box
        sx={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          width: "100%",
          minWidth: isMobile ? 0 : undefined,
          alignItems: isMobile ? "center" : "flex-start",
          gap: isMobile ? 1 : 4,
          marginTop: { xs: 1, sm: 0 }, // Add space for buttons on mobile
        }}
      >
        {/* For mobile, render avatar below connection requests button */}
        {isMobile && (
          <Avatar
            src={profileImageUrl}
            sx={{
              width: 64,
              height: 64,
              bgcolor: "#1976d2",
              fontSize: 28,
              border: "3px solid #fff",
              mb: isMobile ? 0 : 2,
            }}
          >
            {firstName && lastName ? `${firstName[0]}${lastName[0]}` : "?"}
          </Avatar>
        )}
        {/* Left: Avatar + About header (desktop), About header (mobile) */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: isMobile ? 0 : 140,
            flex: isMobile ? "1 1 0%" : "0 0 140px",
            width: isMobile ? "100%" : undefined,
          }}
        >
          {!isMobile && (
            <Avatar
              src={profileImageUrl}
              sx={{
                width: 90,
                height: 90,
                bgcolor: "#1976d2",
                fontSize: 40,
                border: "3px solid #fff",
                mb: 2,
              }}
            >
              {firstName && lastName ? `${firstName[0]}${lastName[0]}` : "?"}
            </Avatar>
          )}
          {/* For mobile, move ABOUT label and text below interests */}
        </Box>
        {/* Right: Main Info */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            width: isMobile ? "100%" : undefined,
            gap: 1,
            mt: 1,
          }}
        >
          <Typography
            variant={isMobile ? "h6" : "h4"}
            sx={{
              fontWeight: 700,
              color: "#181c24",
              mb: 0.5,
              fontSize: isMobile ? 18 : undefined,
              textAlign: "center",
            }}
          >
            {firstName} {lastName}
          </Typography>
          {school && (
            <Typography
              variant="body1"
              sx={{
                color: "#1976d2",
                fontWeight: 600,
                fontSize: isMobile ? 14 : undefined,
                textAlign: "center",
              }}
            >
              <span style={{ fontWeight: 700, color: "#181c24" }}>
                Education:
              </span>{" "}
              {school}
            </Typography>
          )}
          {/* Status and Degree/Intended Degree display, now wrapped */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              width: "100%",
              alignItems: "center",
            }}
          >
            {(() => {
              const statusList = [
                undergraduateStudent ? "Undergraduate Student" : null,
                graduateStudent ? "Graduate Student" : null,
                researchTechnician ? "Research Technician" : null,
                postdoctoralScholar ? "Postdoctoral Scholar" : null,
                principalInvestigator ? "Principal Investigator" : null,
                industryProfessional ? "Industry Professional" : null,
                medicalStudent ? "Medical Student" : null,
                resident ? "Resident" : null,
                physician ? "Physician" : null,
                clinician ? "Clinician" : null,
                otherRole ? `Other: ${otherRole}` : null,
              ].filter(Boolean);
              return (
                <>
                  {statusList.length > 0 && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#1976d2",
                        fontWeight: 500,
                        fontSize: isMobile ? 13 : undefined,
                        wordBreak: "break-word",
                        whiteSpace: "normal",
                        flex: "1 1 100%",
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#181c24" }}>
                        Status:
                      </span>{" "}
                      {statusList.join(", ")}
                    </Typography>
                  )}
                  {undergraduateStudent && intendedDegree ? (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#1976d2",
                        fontWeight: 500,
                        fontSize: isMobile ? 13 : undefined,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#181c24" }}>
                        Intended Degree:
                      </span>{" "}
                      {intendedDegree}
                    </Typography>
                  ) : degree ? (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#1976d2",
                        fontWeight: 500,
                        fontSize: isMobile ? 13 : undefined,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "#181c24" }}>
                        Degree:
                      </span>{" "}
                      {degree}
                    </Typography>
                  ) : null}
                </>
              );
            })()}
          </Box>

          {/* Always render ABOUT label and text centered below interests if about is present */}
          {/* About section removed; now handled by AboutCard */}
        </Box>
      </Box>
      {/* Place buttons at the very bottom, under About section */}
      {showRequestsButton && (
        <Box
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            mt: 2,
          }}
        >
          <Badge
            color="primary"
            variant="dot"
            invisible={!requestsCount || requestsCount === 0}
          >
            <Button
              variant="outlined"
              color="primary"
              onClick={onShowRequests}
              sx={{
                fontWeight: 600,
                fontSize: { xs: 9, sm: 12 },
                width: { xs: "100%", sm: 170 },
                maxWidth: { xs: 200, sm: 170 },
                px: { xs: 0.5, sm: 1.5 },
                py: { xs: 0.25, sm: 0.75 },
              }}
            >
              Requests
            </Button>
          </Badge>
        </Box>
      )}
      <MyNetworkModal
        open={networkOpen}
        onClose={() => setNetworkOpen(false)}
        userId={id}
      />
      <EditProfileDialog
        open={isEditOpen}
        onClose={handleEditClose}
        initialValues={{
          id,
          firstName,
          lastName,
          school,
          undergraduateStudent,
          graduateStudent,
          researchTechnician,
          postdoctoralScholar,
          principalInvestigator,
          industryProfessional,
          medicalStudent,
          resident,
          physician,
          clinician,
          otherRole: otherRole ? "Other" : "",
          degree,
          intendedDegree,
          about,
          labAffiliation,
          currentProjects,        }}
        onSave={(values) => {
          if (onProfileChange) onProfileChange(values);
          // Always close the dialog after save
          if (setForceEditOpen) setForceEditOpen(false);
          setEditOpen(false);
        }}
      />
    </Box>
  );
};

export default ProfileCard;

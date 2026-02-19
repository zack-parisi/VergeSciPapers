import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface CurrentProjectsCardProps {
  currentProjects: string;
}

const CurrentProjectsCard: React.FC<CurrentProjectsCardProps> = ({ currentProjects }) => {
  if (!currentProjects) return null;
  return (
    <Box
      sx={{
        width: { xs: "100vw", sm: 900 },
        maxWidth: { xs: "100vw", sm: 900 },
        minWidth: { xs: 0, sm: 0 },
        bgcolor: "#fff",
        borderRadius: 4,
        boxShadow: "0 2px 16px rgba(25, 118, 210, 0.08)",
        border: "1.5px solid #b6d0ee",
        p: { xs: 2, sm: 4 },
        mx: "auto",
        mt: 3,
        mb: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          color: "#181c24",
          fontWeight: 700,
          letterSpacing: 1,
          textAlign: "left",
          fontSize: 12,
          width: "100%",
        }}
      >
        CURRENT PROJECT(S)
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: "#1976d2",
          fontSize: 13,
          lineHeight: 1.6,
          textAlign: "left",
          mt: 0.5,
          width: "100%",
        }}
      >
        {currentProjects}
      </Typography>
    </Box>
  );
};

export default CurrentProjectsCard;

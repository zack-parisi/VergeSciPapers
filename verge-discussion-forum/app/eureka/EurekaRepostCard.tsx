"use client";
import React, { useState } from "react";
import { Box, Paper, Typography, IconButton, Collapse } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import BubbleChartIcon from "@mui/icons-material/BubbleChart";
import EurekaChatFormatter from "./EurekaChatFormatter";

interface EurekaRepostCardProps {
  eurekaData: {
    query?: string;
    content: string;
    metadata?: {
      mode?: string;
    };
  };
  compact?: boolean;
}

export default function EurekaRepostCard({
  eurekaData,
  compact = false,
}: EurekaRepostCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box
      sx={{
        mt: compact ? 1 : 2,
        width: "100%",
        borderRadius: 2,
        border: "1.5px solid rgba(25, 118, 210, 0.12)",
        bgcolor: "#ffffff",
        overflow: "hidden",
      }}
    >
      {/* Collapsible Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 2,
          cursor: "pointer",
          "&:hover": {
            backgroundColor: "rgba(25, 118, 210, 0.04)",
          },
          transition: "background-color 0.2s",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flex: 1,
            minWidth: 0,
          }}
        >
          <BubbleChartIcon sx={{ color: "#1976d2", fontSize: 24 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: "#1976d2",
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {eurekaData.query || "Eureka Response"}
            </Typography>
            {!expanded && (
              <Typography
                variant="caption"
                sx={{
                  color: "#666",
                  mt: 0.5,
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Click to view full response
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton size="small" sx={{ color: "#1976d2", flexShrink: 0 }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* Collapsible Content */}
      <Collapse in={expanded}>
        <Box
          sx={{
            p: 3,
            pt: 2,
            borderTop: "1px solid rgba(25, 118, 210, 0.08)",
            bgcolor: "rgba(255, 255, 255, 0.95)",
          }}
        >
          {eurekaData.metadata?.mode === "chat" ? (
            <EurekaChatFormatter content={eurekaData.content} />
          ) : (
            <Typography
              variant="body2"
              sx={{
                color: "#333",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
              }}
            >
              {eurekaData.content}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

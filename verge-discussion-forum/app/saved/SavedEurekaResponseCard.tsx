"use client";
import React, { useState } from "react";
import { Box, Paper, Typography, IconButton, Collapse } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import BubbleChartIcon from "@mui/icons-material/BubbleChart";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import EurekaChatFormatter from "../eureka/EurekaChatFormatter";
import EurekaResponseFormatter from "../eureka/EurekaResponseFormatter";
import EurekaTranslateFormatter from "../eureka/EurekaTranslateFormatter";
import EurekaUpdateFormatter from "../eureka/EurekaUpdateFormatter";
import EurekaPaperStaffCard from "../eureka/EurekaPaperStaffCard";
import ArticleIcon from "@mui/icons-material/Article";

interface SavedEurekaResponseCardProps {
  eurekaResponse: {
    id: string;
    targetId: string;
    query?: string;
    content: string;
    metadata?: {
      mode?: string;
      notes?: string[];
      clarifications?: string[];
    };
    papers?: any[];
    timestamp?: Date | string;
    addedAt?: Date | string;
    completeData?: any;
  };
  headerIcons?: React.ReactNode;
}

const SavedEurekaResponseCard: React.FC<SavedEurekaResponseCardProps> = ({
  eurekaResponse,
  headerIcons,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [papersExpanded, setPapersExpanded] = useState(false);

  const mode = eurekaResponse.metadata?.mode || "chat";
  const query = eurekaResponse.query || "Eureka Response";
  const timestamp = eurekaResponse.timestamp || eurekaResponse.addedAt;
  const formattedDate = timestamp
    ? new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        borderRadius: 2,
        border: "1px solid rgba(25, 118, 210, 0.12)",
        background: "rgba(255, 255, 255, 0.95)",
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
          pl: 2,
          pr: 0.5, // Reduce right padding to move buttons left (about an inch)
          py: 2,
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
            gap: 2,
            flex: 1,
            minWidth: 0,
          }}
        >
          <BubbleChartIcon sx={{ color: "#1976d2", fontSize: 24 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                color: "#1a1a1a",
                mb: 0.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {query}
            </Typography>
            {formattedDate && (
              <Typography
                variant="caption"
                sx={{ color: "#7f8c8d", fontSize: "0.75rem" }}
              >
                Saved on {formattedDate}
              </Typography>
            )}
          </Box>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexShrink: 0, // Prevent buttons from shrinking
          }}
          onClick={(e) => e.stopPropagation()} // Prevent header click when clicking buttons
        >
          {headerIcons}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            sx={{
              color: "#1976d2",
              "&:hover": {
                backgroundColor: "rgba(25, 118, 210, 0.1)",
              },
            }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Collapsible Content */}
      <Collapse in={expanded}>
        <Box
          sx={{ p: 3, pt: 2, borderTop: "1px solid rgba(25, 118, 210, 0.08)" }}
        >
          {/* Display the Eureka response based on mode */}
          {mode === "chat" ? (
            <EurekaChatFormatter content={eurekaResponse.content} />
          ) : mode === "investigate" ? (
            <EurekaResponseFormatter content={eurekaResponse.content} />
          ) : mode === "translate" ? (
            <EurekaTranslateFormatter content={eurekaResponse.content} />
          ) : mode === "update" ? (
            <EurekaUpdateFormatter content={eurekaResponse.content} />
          ) : (
            <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
              {eurekaResponse.content}
            </Typography>
          )}

          {/* Papers Section */}
          {eurekaResponse.papers && eurekaResponse.papers.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Box
                onClick={() => setPapersExpanded(!papersExpanded)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  mb: 2,
                  p: 1.5,
                  borderRadius: 1,
                  backgroundColor: "rgba(25, 118, 210, 0.04)",
                  "&:hover": {
                    backgroundColor: "rgba(25, 118, 210, 0.08)",
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <ArticleIcon sx={{ fontSize: 20, color: "#1976d2" }} />
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, color: "#1976d2" }}
                  >
                    {eurekaResponse.papers.length} Source Papers
                  </Typography>
                </Box>
                <IconButton size="small" sx={{ color: "#1976d2" }}>
                  {papersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>

              <Collapse in={papersExpanded}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                  }}
                >
                  {eurekaResponse.papers.map((paper, paperIndex) => (
                    <EurekaPaperStaffCard
                      key={paperIndex}
                      paper={paper}
                      index={paperIndex}
                    />
                  ))}
                </Box>
              </Collapse>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default SavedEurekaResponseCard;

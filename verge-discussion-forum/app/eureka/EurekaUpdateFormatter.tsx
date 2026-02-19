"use client";
import React from "react";
import { Box, Typography, Link, Chip } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ScienceIcon from "@mui/icons-material/Science";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import TimelineIcon from "@mui/icons-material/Timeline";

interface UpdateFormatterProps {
  content: string;
}

/**
 * Custom formatter for Update Me Mode responses
 * Handles update digest with proper styling and icons
 */
export default function EurekaUpdateFormatter({
  content,
}: UpdateFormatterProps) {
  if (!content) return null;

  const lines = (content || "").split("\n").filter((line) => line.trim());
  let currentSection = "";

  const renderLineWithLinks = (text: string) => {
    // Split by URLs and create clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, partIndex) => {
      if (part.match(urlRegex)) {
        // Clean up URL (remove trailing punctuation)
        const cleanUrl = part.replace(/[,;.\)]$/, "");
        return (
          <Link
            key={partIndex}
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: "#1976d2",
              textDecoration: "none",
              fontWeight: 500,
              "&:hover": {
                textDecoration: "underline",
                color: "#1565c0",
              },
            }}
          >
            {cleanUrl}
          </Link>
        );
      }
      return <span key={partIndex}>{part}</span>;
    });
  };

  const getSectionIcon = (sectionTitle: string) => {
    if (sectionTitle.includes("Headline"))
      return <TrendingUpIcon sx={{ fontSize: 24 }} />;
    if (sectionTitle.includes("Top Findings"))
      return <ScienceIcon sx={{ fontSize: 24 }} />;
    if (sectionTitle.includes("Cross-Field"))
      return <TimelineIcon sx={{ fontSize: 24 }} />;
    if (sectionTitle.includes("Emerging"))
      return <LightbulbIcon sx={{ fontSize: 24 }} />;
    return null;
  };

  return (
    <Box>
      {lines.map((line, index) => {
        // Main section headers (numbered, e.g., "1) Headline Summary")
        const mainHeaderMatch = line.match(/^(\d+)\)\s+(.+?)(?:\s*\(.*?\))?$/);
        if (mainHeaderMatch) {
          const sectionNumber = mainHeaderMatch[1];
          const sectionTitle = mainHeaderMatch[2]
            .replace(/\s*\(.*?\)/, "")
            .trim();
          currentSection = sectionTitle;

          return (
            <Box
              key={index}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                mt: index > 0 ? 4 : 0,
                mb: 2,
                pb: 1.5,
                borderBottom: "2px solid rgba(25, 118, 210, 0.2)",
              }}
            >
              <Box sx={{ color: "#1976d2" }}>
                {getSectionIcon(sectionTitle)}
              </Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  fontSize: "1.3rem",
                  color: "#1976d2",
                }}
              >
                {sectionNumber}. {sectionTitle}
              </Typography>
            </Box>
          );
        }

        // Top Findings entries (special formatting)
        if (currentSection.includes("Top Findings") && line.match(/^-\s+\*/)) {
          // Extract title and format as a finding card
          const titleMatch = line.match(/\*([^*]+)\*/);
          if (titleMatch) {
            const title = titleMatch[1];
            return (
              <Box
                key={index}
                sx={{
                  ml: 2,
                  mb: 2,
                  p: 2,
                  bgcolor: "rgba(25, 118, 210, 0.04)",
                  borderLeft: "3px solid #1976d2",
                  borderRadius: 1,
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    color: "#1976d2",
                    fontSize: "1.05rem",
                    mb: 0.5,
                  }}
                >
                  {renderLineWithLinks(title)}
                </Typography>
              </Box>
            );
          }
        }

        // Regular bullet points
        if (line.trim().startsWith("-") || line.trim().startsWith("•")) {
          const content = line.replace(/^[-•]\s+/, "");

          // Check if it's a sub-bullet (indented)
          const isSubBullet = line.match(/^\s{2,}[-•]/);

          return (
            <Typography
              key={index}
              variant="body1"
              sx={{
                ml: isSubBullet ? 4 : 2,
                mb: 1.5,
                color: isSubBullet ? "#546e7a" : "#2c3e50",
                fontSize: isSubBullet ? "0.95rem" : "1rem",
                lineHeight: 1.8,
              }}
            >
              {isSubBullet ? "◦" : "•"} {renderLineWithLinks(content)}
            </Typography>
          );
        }

        // Regular paragraph text
        if (line.trim() && !line.match(/^[\d\*#-]/)) {
          return (
            <Typography
              key={index}
              variant="body1"
              sx={{
                mb: 1.5,
                color: "#2c3e50",
                fontSize: "1rem",
                lineHeight: 1.8,
              }}
            >
              {renderLineWithLinks(line)}
            </Typography>
          );
        }

        return null;
      })}
    </Box>
  );
}

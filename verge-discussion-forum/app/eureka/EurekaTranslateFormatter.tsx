"use client";
import React from "react";
import { Box, Typography, Link } from "@mui/material";

interface TranslateFormatterProps {
  content: string;
}

/**
 * Custom formatter for Translate Mode responses
 * Matches Investigate mode styling with clean headers and professional formatting
 */
export default function EurekaTranslateFormatter({
  content,
}: TranslateFormatterProps) {
  if (!content) return null;

  // Clean up the content and split into logical sections
  const cleanContent = content
    .replace(/\d+\.\s*\*\*([^*]+)\*\*/g, "$1") // Remove numbered headers and ** ** formatting
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove ** ** formatting from headers
    .replace(/\([^)]*\)/g, "") // Remove parenthetical text like (2-3 sentences with citations)
    .replace(/•\s*/g, "• ") // Fix bullet points
    .replace(/\n\s*\n/g, "\n\n"); // Clean up extra newlines

  // Split content into sections based on common patterns
  const sections = cleanContent
    .split(/\n\n+/)
    .filter((section) => section.trim());

  const renderSection = (text: string, index: number) => {
    const lines = (text || "").split("\n").filter((line) => line.trim());

    if (lines.length === 0) return null;

    // Check if this is a main header section
    const isHeader = lines[0].match(
      /^(Summary|Detailed|Points|Referenced|Notes|Anchor|Bridge|Target|Crosswalks|Limits|Relationship|Explanation|Divergence|Sources)/i
    );

    if (isHeader) {
      const headerText = lines[0];
      const emoji = getHeaderEmoji(headerText);

      return (
        <Box key={index} sx={{ mb: 4 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: "1.2rem",
              color: "#1976d2",
              mb: 2,
              mt: index > 0 ? 3 : 0,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <span>{emoji}</span>
            <span>{headerText.replace(/^\d+\.?\s*/, "")}</span>
          </Typography>

          {lines.slice(1).map((line, lineIndex) => (
            <Typography
              key={lineIndex}
              variant="body1"
              sx={{
                mb: 1.5,
                color: "#2c3e50",
                lineHeight: 1.6,
                ml: line.startsWith("•") ? 2 : 0,
              }}
            >
              {formatLine(line)}
            </Typography>
          ))}
        </Box>
      );
    }

    // Regular content section
    return (
      <Box key={index} sx={{ mb: 3 }}>
        {lines.map((line, lineIndex) => {
          if (line.startsWith("•")) {
            return (
              <Typography
                key={lineIndex}
                variant="body1"
                sx={{
                  mb: 1.5,
                  ml: 2,
                  color: "#2c3e50",
                  lineHeight: 1.6,
                }}
              >
                {formatLine(line)}
              </Typography>
            );
          }

          if (line.includes('"') && line.includes("Paper")) {
            return (
              <Box
                key={lineIndex}
                sx={{
                  ml: 3,
                  pl: 2,
                  borderLeft: "3px solid #1976d2",
                  bgcolor: "rgba(25, 118, 210, 0.05)",
                  py: 1,
                  mb: 1.5,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontStyle: "italic",
                    color: "#1976d2",
                    lineHeight: 1.5,
                  }}
                >
                  {formatLine(line)}
                </Typography>
              </Box>
            );
          }

          return (
            <Typography
              key={lineIndex}
              variant="body1"
              sx={{
                mb: 1.5,
                color: "#2c3e50",
                lineHeight: 1.6,
              }}
            >
              {formatLine(line)}
            </Typography>
          );
        })}
      </Box>
    );
  };

  const getHeaderEmoji = (header: string) => {
    if (header.toLowerCase().includes("summary")) return "";
    if (
      header.toLowerCase().includes("detailed") ||
      header.toLowerCase().includes("explanation")
    )
      return "";
    if (
      header.toLowerCase().includes("points") ||
      header.toLowerCase().includes("divergence")
    )
      return "";
    if (
      header.toLowerCase().includes("referenced") ||
      header.toLowerCase().includes("sources")
    )
      return "";
    if (header.toLowerCase().includes("notes")) return "";
    if (header.toLowerCase().includes("relationship")) return "";
    if (header.toLowerCase().includes("anchor")) return "";
    if (header.toLowerCase().includes("bridge")) return "";
    if (header.toLowerCase().includes("target")) return "";
    if (header.toLowerCase().includes("crosswalks")) return "";
    if (header.toLowerCase().includes("limits")) return "";
    return "";
  };

  const formatLine = (line: string) => {
    // Convert Paper X links to proper format
    const formattedLine = line.replace(/Paper\s+(\d+)/g, (match, num) => {
      return `[Paper ${num}](https://openalex.org/W${num})`;
    });

    // Split by URLs and create clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = formattedLine.split(urlRegex);

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

  return (
    <Box>{sections.map((section, index) => renderSection(section, index))}</Box>
  );
}

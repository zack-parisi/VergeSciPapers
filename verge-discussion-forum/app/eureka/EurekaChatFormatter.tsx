"use client";
import React from "react";
import { Box, Typography } from "@mui/material";

interface EurekaChatFormatterProps {
  content: string;
}

/**
 * Formats Eureka Chat Mode responses with clean typography
 * Handles headers, bullet points, and structured content
 */
export default function EurekaChatFormatter({
  content,
}: EurekaChatFormatterProps) {
  if (!content) return null;

  // Helper function to convert text to title case
  const toTitleCase = (text: string): string => {
    return text
      .split(" ")
      .map((word) => {
        if (word.length === 0) return word;
        return word[0].toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  };

  // Helper function to capitalize first letter of sentence
  const capitalizeSentence = (text: string): string => {
    if (text.length === 0) return text;
    return text[0].toUpperCase() + text.slice(1);
  };

  const parseContent = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];

    let currentNestedList: React.ReactNode[] = [];
    let currentTopLevelList: React.ReactNode[] = [];
    let inNestedList = false;
    let inTopLevelList = false;
    let lastWasHeader = false;
    let inHeaderSection = false; // Track if we're in a section that started with a header

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        // Empty line - close lists if open
        if (inNestedList && currentNestedList.length > 0) {
          elements.push(
            <Box
              key={`nested-list-${index}`}
              component="ul"
              sx={{ pl: 4, mb: 2, mt: 0.5 }}
            >
              {currentNestedList}
            </Box>
          );
          currentNestedList = [];
          inNestedList = false;
        }
        if (inTopLevelList && currentTopLevelList.length > 0) {
          elements.push(
            <Box
              key={`top-list-${index}`}
              component="ul"
              sx={{ pl: 3, mb: 2, mt: 0.5, listStyle: "none" }}
            >
              {currentTopLevelList}
            </Box>
          );
          currentTopLevelList = [];
          inTopLevelList = false;
        }
        lastWasHeader = false;
        return;
      }

      // Explicit Markdown main header (## )
      if (trimmedLine.startsWith("## ")) {
        const headerText = trimmedLine.substring(3).trim();

        // Close lists if open
        if (inNestedList && currentNestedList.length > 0) {
          elements.push(
            <Box
              key={`nested-list-${index}`}
              component="ul"
              sx={{ pl: 4, mb: 2, mt: 0.5 }}
            >
              {currentNestedList}
            </Box>
          );
          currentNestedList = [];
          inNestedList = false;
        }
        if (inTopLevelList && currentTopLevelList.length > 0) {
          elements.push(
            <Box
              key={`top-list-${index}`}
              component="ul"
              sx={{ pl: 3, mb: 2, mt: 0.5, listStyle: "none" }}
            >
              {currentTopLevelList}
            </Box>
          );
          currentTopLevelList = [];
          inTopLevelList = false;
        }

        elements.push(
          <Typography
            key={`md-main-header-${index}`}
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: "1.4rem",
              color: "#1976d2",
              mt: index === 0 ? 0 : 4,
              mb: 1.5,
              lineHeight: 1.4,
              letterSpacing: "-0.01em",
            }}
          >
            {headerText}
          </Typography>
        );

        lastWasHeader = true;
        inHeaderSection = true;
        return;
      }

      // Explicit Markdown sub-header (### )
      if (trimmedLine.startsWith("### ")) {
        const subHeaderText = trimmedLine.substring(4).trim();

        if (inNestedList && currentNestedList.length > 0) {
          elements.push(
            <Box
              key={`nested-list-${index}`}
              component="ul"
              sx={{ pl: 4, mb: 2, mt: 0.5 }}
            >
              {currentNestedList}
            </Box>
          );
          currentNestedList = [];
          inNestedList = false;
        }
        if (inTopLevelList && currentTopLevelList.length > 0) {
          elements.push(
            <Box
              key={`top-list-${index}`}
              component="ul"
              sx={{ pl: 3, mb: 2, mt: 0.5, listStyle: "none" }}
            >
              {currentTopLevelList}
            </Box>
          );
          currentTopLevelList = [];
          inTopLevelList = false;
        }

        elements.push(
          <Typography
            key={`md-sub-header-${index}`}
            variant="subtitle1"
            sx={{
              fontWeight: 900,
              fontSize: "1.15rem",
              color: "#1a1a1a",
              mt: 2,
              mb: 1,
              lineHeight: 1.4,
            }}
          >
            {toTitleCase(subHeaderText)}
          </Typography>
        );

        lastWasHeader = false;
        inHeaderSection = true;
        return;
      }

      // Check for main section headers
      // Pattern 1: "Header:" or "Header: content"
      // Pattern 2: Standalone header line (capital letter, short, not a bullet, followed by empty line and content)
      const headerWithColonMatch = trimmedLine.match(/^([A-Z][^:]+):\s*(.*)$/);
      const prevLineEmpty = index === 0 || lines[index - 1]?.trim() === "";
      // Standalone header: short phrase, starts with capital, previous line empty, not a full sentence
      const isShortPhrase = trimmedLine.split(/\s+/).length <= 6; // Max 6 words
      const isNotFullSentence =
        !trimmedLine.endsWith(".") || trimmedLine.length < 50;
      const isStandaloneHeader =
        !trimmedLine.startsWith("-") &&
        !trimmedLine.startsWith(" ") &&
        /^[A-Z]/.test(trimmedLine) &&
        trimmedLine.length < 100 && // Reasonable header length
        isShortPhrase &&
        isNotFullSentence &&
        prevLineEmpty; // Previous line is empty or this is first line

      if (
        (headerWithColonMatch || isStandaloneHeader) &&
        !trimmedLine.startsWith("-")
      ) {
        let headerText: string;
        let headerContent: string = "";

        if (headerWithColonMatch) {
          headerText = headerWithColonMatch[1];
          headerContent = headerWithColonMatch[2].trim();
        } else {
          headerText = trimmedLine;
        }

        // Close lists if open
        if (inNestedList && currentNestedList.length > 0) {
          elements.push(
            <Box
              key={`nested-list-${index}`}
              component="ul"
              sx={{ pl: 4, mb: 2, mt: 0.5 }}
            >
              {currentNestedList}
            </Box>
          );
          currentNestedList = [];
          inNestedList = false;
        }
        if (inTopLevelList && currentTopLevelList.length > 0) {
          elements.push(
            <Box
              key={`top-list-${index}`}
              component="ul"
              sx={{ pl: 3, mb: 2, mt: 0.5, listStyle: "none" }}
            >
              {currentTopLevelList}
            </Box>
          );
          currentTopLevelList = [];
          inTopLevelList = false;
        }

        // Main section header - bold, blue, larger
        elements.push(
          <Typography
            key={`main-header-${index}`}
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: "1.4rem",
              color: "#1976d2",
              mt: index === 0 ? 0 : 4,
              mb: headerContent ? 1.5 : 2.5,
              lineHeight: 1.4,
              letterSpacing: "-0.01em",
            }}
          >
            {headerText}
          </Typography>
        );

        // If there's content after the colon, add it as a paragraph
        if (headerContent) {
          elements.push(
            <Typography
              key={`header-content-${index}`}
              variant="body1"
              sx={{
                mb: 2.5,
                color: "#2c3e50",
                fontSize: "1.05rem",
                lineHeight: 1.8,
                fontWeight: 400,
              }}
            >
              {capitalizeSentence(headerContent)}
            </Typography>
          );
        }

        lastWasHeader = true;
        inHeaderSection = true; // We're now in a header section
        return;
      }

      // Check for subsection headers (starts with "- " followed by capital letter)
      // Handle both "- Header" and "- Header: content"
      const subsectionMatch = trimmedLine.match(/^-\s+([A-Z][^:]+):?\s*(.*)$/);
      if (subsectionMatch) {
        const subHeaderText = subsectionMatch[1];
        const subHeaderContent = subsectionMatch[2].trim();

        // Close lists if open
        if (inNestedList && currentNestedList.length > 0) {
          elements.push(
            <Box
              key={`nested-list-${index}`}
              component="ul"
              sx={{ pl: 4, mb: 2, mt: 0.5 }}
            >
              {currentNestedList}
            </Box>
          );
          currentNestedList = [];
          inNestedList = false;
        }
        if (inTopLevelList && currentTopLevelList.length > 0) {
          elements.push(
            <Box
              key={`top-list-${index}`}
              component="ul"
              sx={{ pl: 3, mb: 2, mt: 0.5, listStyle: "none" }}
            >
              {currentTopLevelList}
            </Box>
          );
          currentTopLevelList = [];
          inTopLevelList = false;
        }

        // Subsection header
        elements.push(
          <Typography
            key={`sub-header-${index}`}
            variant="subtitle1"
            sx={{
              fontWeight: 400, // Normal weight, not bold
              fontSize: "1.1rem",
              color: "#2c3e50",
              mt: lastWasHeader ? 1 : 2,
              mb: subHeaderContent ? 0.5 : 1,
              ml: 1,
            }}
          >
            {subHeaderText}
          </Typography>
        );

        // If there's content after the colon, add it as a paragraph
        if (subHeaderContent) {
          elements.push(
            <Typography
              key={`sub-header-content-${index}`}
              variant="body2"
              sx={{
                mb: 1,
                color: "#2c3e50",
                fontSize: "0.95rem",
                lineHeight: 1.7,
                ml: 1,
              }}
            >
              {capitalizeSentence(subHeaderContent)}
            </Typography>
          );
        }

        lastWasHeader = false;
        return;
      }

      // Check for nested bullet points (indented with 2+ spaces)
      const nestedBulletMatch = trimmedLine.match(/^\s{2,}-\s+(.+)$/);
      if (nestedBulletMatch) {
        if (!inNestedList) {
          inNestedList = true;
        }
        const capitalizedNestedText = capitalizeSentence(nestedBulletMatch[1]);
        currentNestedList.push(
          <Box
            key={`nested-item-${index}`}
            component="li"
            sx={{
              mb: 1,
              color: "#2c3e50",
              fontSize: "0.95rem",
              lineHeight: 1.7,
            }}
          >
            {capitalizedNestedText}
          </Box>
        );
        lastWasHeader = false;
        return;
      }

      // Check for top-level bullet points
      const bulletMatch = trimmedLine.match(/^-\s+(.+)$/);
      if (bulletMatch) {
        // Close nested list if it was open
        if (inNestedList && currentNestedList.length > 0) {
          elements.push(
            <Box
              key={`nested-list-${index}`}
              component="ul"
              sx={{ pl: 4, mb: 2, mt: 0.5 }}
            >
              {currentNestedList}
            </Box>
          );
          currentNestedList = [];
          inNestedList = false;
        }

        // Add to top-level list
        if (!inTopLevelList) {
          inTopLevelList = true;
        }
        const capitalizedBulletText = capitalizeSentence(bulletMatch[1]);
        currentTopLevelList.push(
          <Box
            key={`bullet-${index}`}
            component="li"
            sx={{
              mb: 1.5,
              color: "#2c3e50",
              fontSize: "1rem",
              lineHeight: 1.7,
              listStyle: "none",
              position: "relative",
              pl: 2.5,
              "&::before": {
                content: '"•"',
                position: "absolute",
                left: 0.5,
                color: "#1976d2",
                fontWeight: "normal", // Normal weight for bullet character
                fontSize: "1.2rem",
              },
            }}
          >
            {capitalizedBulletText}
          </Box>
        );
        lastWasHeader = false;
        return;
      }

      // Check for sub-headers (short phrases that appear after main headers)
      // These are like "Receptor actions and cellular excitability" - black, bold
      const isSubHeader =
        !trimmedLine.startsWith("-") &&
        !trimmedLine.startsWith(" ") &&
        trimmedLine.length < 80 &&
        trimmedLine.split(/\s+/).length <= 8 && // Max 8 words
        !trimmedLine.endsWith(".") && // Not a full sentence
        !trimmedLine.includes(":") && // Not a header with colon
        inHeaderSection && // We're in a section that started with a header
        index < lines.length - 1 &&
        lines[index + 1]?.trim() !== ""; // Has content after it

      if (isSubHeader) {
        // Close lists if open
        if (inNestedList && currentNestedList.length > 0) {
          elements.push(
            <Box
              key={`nested-list-${index}`}
              component="ul"
              sx={{ pl: 4, mb: 2, mt: 0.5 }}
            >
              {currentNestedList}
            </Box>
          );
          currentNestedList = [];
          inNestedList = false;
        }
        if (inTopLevelList && currentTopLevelList.length > 0) {
          elements.push(
            <Box
              key={`top-list-${index}`}
              component="ul"
              sx={{ pl: 3, mb: 2, mt: 0.5, listStyle: "none" }}
            >
              {currentTopLevelList}
            </Box>
          );
          currentTopLevelList = [];
          inTopLevelList = false;
        }

        // Sub-header - black, extra bold, title case
        const titleCaseText = toTitleCase(trimmedLine);
        elements.push(
          <Typography
            key={`sub-header-standalone-${index}`}
            variant="subtitle1"
            sx={{
              fontWeight: 900, // Extra bold
              fontSize: "1.15rem",
              color: "#1a1a1a", // Black
              mt: 2.5,
              mb: 1.5,
              lineHeight: 1.4,
            }}
          >
            {titleCaseText}
          </Typography>
        );
        lastWasHeader = false;
        // Don't reset inHeaderSection - sub-headers can appear after other sub-headers
        return;
      }

      // Regular paragraph text (not a bullet, not a header, not empty)
      if (trimmedLine && !trimmedLine.startsWith("-")) {
        // If we hit a new main header section, reset the flag
        // (This will be caught by the main header detection above)
        // Close lists if open
        if (inNestedList && currentNestedList.length > 0) {
          elements.push(
            <Box
              key={`nested-list-${index}`}
              component="ul"
              sx={{ pl: 4, mb: 2, mt: 0.5 }}
            >
              {currentNestedList}
            </Box>
          );
          currentNestedList = [];
          inNestedList = false;
        }
        if (inTopLevelList && currentTopLevelList.length > 0) {
          elements.push(
            <Box
              key={`top-list-${index}`}
              component="ul"
              sx={{ pl: 3, mb: 2, mt: 0.5, listStyle: "none" }}
            >
              {currentTopLevelList}
            </Box>
          );
          currentTopLevelList = [];
          inTopLevelList = false;
        }

        // Regular paragraph - improved styling, capitalize first letter
        const capitalizedText = capitalizeSentence(trimmedLine);
        elements.push(
          <Typography
            key={`para-${index}`}
            variant="body1"
            sx={{
              mb: 2.5,
              color: "#2c3e50",
              fontSize: "1.05rem",
              lineHeight: 1.85,
              fontWeight: 400,
            }}
          >
            {capitalizedText}
          </Typography>
        );
        lastWasHeader = false;
        // Keep inHeaderSection true - paragraphs can appear in header sections
      }
    });

    // Close any remaining open lists
    if (inNestedList && currentNestedList.length > 0) {
      elements.push(
        <Box
          key="final-nested-list"
          component="ul"
          sx={{ pl: 4, mb: 2, mt: 0.5 }}
        >
          {currentNestedList}
        </Box>
      );
    }
    if (inTopLevelList && currentTopLevelList.length > 0) {
      elements.push(
        <Box
          key="final-top-list"
          component="ul"
          sx={{ pl: 3, mb: 2, mt: 0.5, listStyle: "none" }}
        >
          {currentTopLevelList}
        </Box>
      );
    }

    return elements;
  };

  return <Box>{parseContent(content)}</Box>;
}

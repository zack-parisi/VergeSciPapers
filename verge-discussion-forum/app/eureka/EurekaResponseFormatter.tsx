import React from "react";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Box from "@mui/material/Box";

interface EurekaResponseFormatterProps {
  content: string;
}

/**
 * Formats Eureka AI responses with:
 * - Bold section headers (, , , )
 * - Clickable OpenAlex IDs
 * - Clickable DOI links
 * - Clickable all other URLs
 */
export default function EurekaResponseFormatter({
  content,
}: EurekaResponseFormatterProps) {
  const parseContent = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      // Check if line is a section header (emoji + **text**)
      const headerMatch = line.match(/^(|||)\s*\*\*(.+?)\*\*/);

      if (headerMatch) {
        // Section header - larger, bold, no asterisks
        elements.push(
          <Typography
            key={`header-${index}`}
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: "1.3rem",
              color: "#1a1a1a",
              mt: index === 0 ? 0 : 3,
              mb: 1.5,
              letterSpacing: "-0.01em",
            }}
          >
            {headerMatch[1]} {headerMatch[2]}
          </Typography>
        );
      } else {
        // Regular line - parse for links and formatting
        const formattedLine = parseLineWithLinks(line);

        if (formattedLine) {
          elements.push(
            <Typography
              key={`line-${index}`}
              component="div"
              sx={{
                fontSize: "1.05rem",
                lineHeight: 1.8,
                color: "#2c3e50",
                mb: 0.5,
              }}
            >
              {formattedLine}
            </Typography>
          );
        } else if (line.trim() === "") {
          // Empty line - add spacing
          elements.push(<Box key={`space-${index}`} sx={{ height: 8 }} />);
        }
      }
    });

    return elements;
  };

  const parseLineWithLinks = (line: string): React.ReactNode => {
    if (!line.trim()) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Regex patterns
    const patterns = [
      // OpenAlex ID pattern: "OpenAlex: W2990046166" or "https://openalex.org/W2990046166"
      {
        regex: /OpenAlex:\s*(W\d+)/gi,
        handler: (match: RegExpExecArray) => {
          const id = match[1];
          return (
            <Link
              href={`https://openalex.org/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: "#1976d2",
                textDecoration: "none",
                fontWeight: 500,
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              @{id}
            </Link>
          );
        },
      },
      // Direct OpenAlex URL
      {
        regex: /https:\/\/openalex\.org\/(W\d+)/gi,
        handler: (match: RegExpExecArray) => {
          const id = match[1];
          return (
            <Link
              href={match[0]}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: "#1976d2",
                textDecoration: "none",
                fontWeight: 500,
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              @{id}
            </Link>
          );
        },
      },
      // DOI pattern
      {
        regex: /DOI:\s*(https?:\/\/doi\.org\/[^\s;,)]+)/gi,
        handler: (match: RegExpExecArray) => {
          return (
            <Link
              href={match[1]}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: "#1976d2",
                textDecoration: "none",
                fontWeight: 500,
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              DOI: {match[1].replace("https://doi.org/", "")}
            </Link>
          );
        },
      },
      // Any other URL
      {
        regex: /(https?:\/\/[^\s,;)]+)/gi,
        handler: (match: RegExpExecArray) => {
          // Don't double-link if already handled by other patterns
          if (
            match[0].includes("openalex.org") ||
            match[0].includes("doi.org")
          ) {
            return null;
          }
          return (
            <Link
              href={match[0]}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: "#1976d2",
                textDecoration: "none",
                fontWeight: 500,
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              {match[0]}
            </Link>
          );
        },
      },
    ];

    // Find all matches
    const matches: Array<{
      index: number;
      length: number;
      element: React.ReactNode;
    }> = [];

    patterns.forEach((pattern) => {
      const regex = new RegExp(pattern.regex);
      let match;

      while ((match = regex.exec(line)) !== null) {
        const element = pattern.handler(match);
        if (element) {
          matches.push({
            index: match.index,
            length: match[0].length,
            element,
          });
        }
      }
    });

    // Sort matches by index
    matches.sort((a, b) => a.index - b.index);

    // Build the line with replaced links
    matches.forEach((match, i) => {
      // Add text before this match
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }

      // Add the link element
      parts.push(
        <React.Fragment key={`link-${i}`}>{match.element}</React.Fragment>
      );

      lastIndex = match.index + match.length;
    });

    // Add remaining text
    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    // If no matches found, return the original line
    return parts.length > 0 ? parts : line;
  };

  return <>{parseContent(content)}</>;
}

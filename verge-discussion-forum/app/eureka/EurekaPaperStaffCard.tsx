"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import StaffPostCard from "../../home_feed_page/StaffPostCard";
import { StaffPost } from "../forum_feed_page/staffPostApi";

interface EurekaPaper {
  title: string;
  authors: string | string[];
  journal: string;
  year?: string;
  publication_date?: string;
  doi?: string;
  similarity_score?: number;
  abstract?: string;
  work_id?: string;
  subfields?: string[];
  cited_by_count?: number;
  keywords?: string[];
  open_access?: any;
}

interface EurekaPaperStaffCardProps {
  paper: EurekaPaper;
  index: number;
}

/**
 * Wrapper that converts Eureka paper data into StaffPost format
 * to display using the existing StaffPostCard component
 */
export default function EurekaPaperStaffCard({
  paper,
  index,
}: EurekaPaperStaffCardProps) {
  const router = useRouter();
  const [isInIframe, setIsInIframe] = useState(false);

  // Detect if we're in an iframe (popup context)
  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // Extract OpenAlex ID from work_id
  const getOpenAlexId = () => {
    if (paper.work_id) {
      return paper.work_id;
    }
    return `paper-${index}`;
  };

  // Handle click on paper card to navigate to forum
  const handleCardClick = () => {
    if (paper.work_id) {
      // Extract numeric ID from work_id (handles formats like:
      // "https://openalex.org/W1971440513", "W1971440513", or "1971440513")
      const numericId = parseInt(paper.work_id.replace(/\D/g, ""));
      if (numericId) {
        // Check if we're in an iframe (Eureka popup)
        const isInIframe = window.self !== window.top;

        if (isInIframe) {
          // If in popup/iframe, navigate the parent window to the forum page
          // Set flag to keep Eureka chat popup open after navigation
          try {
            // Try to set sessionStorage in parent window
            if (window.parent && window.parent.sessionStorage) {
              window.parent.sessionStorage.setItem("openEurekaChat", "true");
            }
          } catch (e) {
            // Cross-origin restrictions might prevent access, set in current window as fallback
            sessionStorage.setItem("openEurekaChat", "true");
          }

          // Navigate the parent window to the forum page
          if (window.parent) {
            window.parent.location.href = `/forum/${numericId}`;
          } else if (window.top) {
            window.top.location.href = `/forum/${numericId}`;
          }
        } else {
          // If not in iframe (normal page), navigate normally
          // Set flag to open Eureka chat popup after navigation
          sessionStorage.setItem("openEurekaChat", "true");
          router.push(`/forum/${numericId}`);
        }
      } else {
        console.error(
          "Could not extract numeric ID from work_id:",
          paper.work_id
        );
      }
    } else {
      console.error("No work_id available for paper:", paper.title);
    }
  };

  // Convert Eureka paper to StaffPost format
  const convertToStaffPost = (): StaffPost => {
    // Ensure publication_date is in correct format (YYYY-MM-DD)
    let publicationDate: string | undefined;

    // Prefer publication_date if available
    if (paper.publication_date) {
      const dateStr = paper.publication_date.trim();
      // Validate date format (YYYY-MM-DD or YYYY)
      if (dateStr.match(/^\d{4}(-\d{2}-\d{2})?$/)) {
        publicationDate = dateStr.includes("-") ? dateStr : `${dateStr}-01-01`;
      } else if (dateStr.match(/^\d{4}$/)) {
        // Just a year
        publicationDate = `${dateStr}-01-01`;
      }
    } else if (paper.year) {
      const yearStr = String(paper.year).trim();
      // Validate year format
      if (yearStr.match(/^\d{4}(-\d{2}-\d{2})?$/)) {
        publicationDate = yearStr.includes("-") ? yearStr : `${yearStr}-01-01`;
      } else if (yearStr.match(/^\d{4}$/)) {
        // Just a year
        publicationDate = `${yearStr}-01-01`;
      }
    }

    // Validate the final date string
    if (publicationDate) {
      const testDate = new Date(publicationDate + "T00:00:00");
      if (isNaN(testDate.getTime())) {
        // Invalid date, set to undefined
        publicationDate = undefined;
      }
    }

    // Convert authors to array (handle both string and array formats)
    // String format from Investigate mode: "Smith J | Doe A | Johnson B"
    // Array format from Quick Search mode: ["Smith J", "Doe A", "Johnson B"]
    const authorsArray = paper.authors
      ? Array.isArray(paper.authors)
        ? paper.authors
        : paper.authors.split("|").map((author) => author.trim())
      : [];

    return {
      id: getOpenAlexId() as any,
      userId: "eureka-ai",
      title: paper.title,
      authors: authorsArray, // Array of strings (camelCase)
      publicationDate: publicationDate || "", // camelCase - fallback to empty string if undefined
      citedByCount: paper.cited_by_count || 0, // camelCase
      abstract: paper.abstract || "",
      doi: paper.doi || "",
      linkId: paper.work_id || "",
      citation: "",
      subfields: paper.subfields || [],
      createdAt: new Date().toISOString(),
      journal: paper.journal,
      likes: 0,
      comments: 0,
      bookmarks: 0,
      reposts: 0,
      relevanceScore: paper.similarity_score || 0,
    };
  };

  const staffPost = convertToStaffPost();

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: isInIframe ? "100%" : "none",
        // Constrain width when in popup to prevent overflow
        ...(isInIframe && {
          "& > *": {
            maxWidth: "100%",
            overflow: "hidden",
          },
        }),
      }}
    >
      <StaffPostCard
        post={staffPost}
        hideActions={true}
        hideLikeButton={true}
        showBookmark={false}
        compact={true}
        onClick={handleCardClick}
        headerIcons={
          paper.similarity_score !== undefined && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: "12px",
                backgroundColor: "rgba(25, 118, 210, 0.1)",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#1976d2",
              }}
            >
              {(paper.similarity_score * 100).toFixed(1)}% match
            </div>
          )
        }
      />
    </Box>
  );
}

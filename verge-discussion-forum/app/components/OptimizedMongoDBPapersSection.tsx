"use client";
import React, { useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import Link from "next/link";
import AlgorithmSelector from "./AlgorithmSelector";
import { PaperAlgorithmType } from "../../lib/paper-algorithms";
import { usePapersDataStore } from "../../lib/papers-data-store";

interface OptimizedMongoDBPapersSectionProps {
  title?: string;
  limit?: number;
  minRelevance?: number;
  algorithm?: PaperAlgorithmType;
  showViewAll?: boolean;
  compact?: boolean;
  autoFetch?: boolean;
}

export default function OptimizedMongoDBPapersSection({
  title = "Latest Research Papers",
  limit = 3,
  minRelevance = 0.8,
  algorithm = "relevance",
  showViewAll = true,
  compact = false,
  autoFetch = true,
}: OptimizedMongoDBPapersSectionProps) {
  const { loading, error, papers, getPapers, fetchPapers, hasData } =
    usePapersDataStore();

  // Get papers for current algorithm
  const currentPapers = React.useMemo(() => {
    return getPapers(algorithm).slice(0, limit);
  }, [getPapers, algorithm, limit]);

  // Fetch data on mount if needed
  useEffect(() => {
    if (autoFetch && !hasData && !loading) {
      fetchPapers({ limit: Math.max(limit, 20), minRelevance });
    }
  }, [autoFetch, hasData, loading, fetchPapers, limit, minRelevance]);

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error loading papers: {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 2,
          gap: 2,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            {title}
          </Typography>
          <AlgorithmSelector
            algorithm={algorithm}
            onAlgorithmChange={(newAlgorithm) => {
              // Algorithm switching is instant - no API call needed!
              getPapers(newAlgorithm);
            }}
            size="small"
            showDescription={false}
          />
        </Box>
      </Box>

      {/* Loading State */}
      {loading && !hasData && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Papers List */}
      {!loading && currentPapers.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {currentPapers.map((paper) => (
            <Card
              key={paper.id}
              variant="outlined"
              sx={{
                "&:hover": {
                  boxShadow: 2,
                  borderColor: "primary.main",
                },
                transition: "all 0.2s ease-in-out",
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    mb: 1,
                    lineHeight: 1.3,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {paper.title}
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  {paper.authors.slice(0, 3).join(", ")}
                  {paper.authors.length > 3 && " et al."}
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  {paper.journal} •{" "}
                  {paper.publicationDate
                    ? new Date(
                        paper.publicationDate + "T00:00:00"
                      ).getFullYear()
                    : ""}
                </Typography>

                <Box sx={{ display: "flex", gap: 1, mb: 1, flexWrap: "wrap" }}>
                  <Chip
                    label={`${paper.citedByCount} citations`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    label={`Relevance: ${paper.relevanceScore?.toFixed(1)}`}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                </Box>

                {!compact && (
                  <Typography
                    variant="body2"
                    sx={{
                      mb: 1,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      color: "text.secondary",
                    }}
                  >
                    {paper.abstract}
                  </Typography>
                )}

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {paper.subfields.slice(0, 2).map((subfield, index) => (
                    <Chip
                      key={index}
                      label={subfield}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: "0.7rem",
                        borderColor: "#1976d2",
                        color: "#1976d2",
                        "&:hover": {
                          borderColor: "#1565c0",
                          backgroundColor: "rgba(25, 118, 210, 0.04)",
                        },
                      }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* No Results */}
      {!loading && hasData && currentPapers.length === 0 && (
        <Alert severity="info">
          No papers found for the current algorithm. Try switching algorithms.
        </Alert>
      )}

      {/* Load More Button */}
      {showViewAll && !loading && currentPapers.length >= limit && (
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Link href="/mongodb-papers" passHref>
            <Button variant="text" size="small" sx={{ textTransform: "none" }}>
              View More Papers →
            </Button>
          </Link>
        </Box>
      )}
    </Box>
  );
}

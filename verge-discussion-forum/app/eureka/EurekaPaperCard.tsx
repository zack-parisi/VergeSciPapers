"use client";
import React from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface EurekaPaper {
  title: string;
  authors: string;
  journal: string;
  year: string;
  doi?: string;
  similarity_score?: number;
}

interface EurekaPaperCardProps {
  paper: EurekaPaper;
  index: number;
}

export default function EurekaPaperCard({ paper, index }: EurekaPaperCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "#fafafa",
        border: "1px solid #e0e0e0",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
          [{index + 1}]
        </Typography>
        {paper.similarity_score !== undefined && (
          <Chip
            label={`${(paper.similarity_score * 100).toFixed(1)}% match`}
            size="small"
            sx={{
              bgcolor: "#e3f2fd",
              color: "#1976d2",
              fontWeight: 600,
              fontSize: "0.75rem",
            }}
          />
        )}
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, lineHeight: 1.4 }}>
        {paper.title}
      </Typography>

      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
        {paper.authors}
      </Typography>

      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
        {paper.journal} ({paper.year})
      </Typography>

      {paper.doi && (
        <Link
          href={paper.doi}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            fontSize: "0.75rem",
            textDecoration: "none",
            "&:hover": {
              textDecoration: "underline",
            },
          }}
        >
          View Paper
          <OpenInNewIcon sx={{ fontSize: "0.875rem" }} />
        </Link>
      )}
    </Paper>
  );
}


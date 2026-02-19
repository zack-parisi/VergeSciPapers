"use client";
import React from "react";
import {
  Box,
  Typography,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import {
  PAPER_ALGORITHMS,
  PaperAlgorithmType,
} from "../../lib/paper-algorithms";

interface AlgorithmSelectorProps {
  algorithm: PaperAlgorithmType;
  onAlgorithmChange: (algorithm: PaperAlgorithmType) => void;
  showDescription?: boolean;
  size?: "small" | "medium" | "large";
}

export default function AlgorithmSelector({
  algorithm,
  onAlgorithmChange,
  showDescription = false,
  size = "medium",
}: AlgorithmSelectorProps) {
  const handleChange = (
    event: React.MouseEvent<HTMLElement>,
    newAlgorithm: PaperAlgorithmType
  ) => {
    if (newAlgorithm !== null) {
      onAlgorithmChange(newAlgorithm);
    }
  };

  const currentAlgorithm = PAPER_ALGORITHMS[algorithm];

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <ToggleButtonGroup
        value={algorithm}
        exclusive
        onChange={handleChange}
        aria-label="paper algorithm"
        size={size}
      >
        <Tooltip title={PAPER_ALGORITHMS.seminal.description}>
          <ToggleButton value="seminal" aria-label="seminal papers">
             Seminal
          </ToggleButton>
        </Tooltip>
        <Tooltip title={PAPER_ALGORITHMS.relevance.description}>
          <ToggleButton value="relevance" aria-label="current papers">
             Current
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      {showDescription && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label={algorithm === "seminal" ? "Seminal" : "Current"}
            color={algorithm === "seminal" ? "secondary" : "primary"}
            size="small"
            variant="outlined"
          />
          <Typography variant="caption" color="text.secondary">
            {currentAlgorithm.description}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

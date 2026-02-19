import React from "react";
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  Collapse,
  Slider,
  Typography,
  Chip,
  Button,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

interface SearchFiltersProps {
  onApply: () => void;
  // Publication date filters
  yearRange: [number, number];
  onYearRangeChange: (range: [number, number]) => void;

  // Citation filters
  citationRange: [number, number];
  onCitationRangeChange: (range: [number, number]) => void;
  minCitations: number;
  onMinCitationsChange: (minCitations: number) => void;

  // UI state
  showFilters: boolean;
  onToggleFilters: () => void;
  onClearFilters: () => void;

  // Compact mode for mobile
  compact?: boolean;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  onApply,
  yearRange,
  onYearRangeChange,
  citationRange,
  onCitationRangeChange,
  minCitations,
  onMinCitationsChange,
  showFilters,
  onToggleFilters,
  onClearFilters,
  compact = false,
}) => {
  const hasActiveFilters =
    minCitations > 0 ||
    yearRange[0] !== 1990 ||
    yearRange[1] !== new Date().getFullYear();

  if (compact) {
    // Compact mode: just show the filter button
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Tooltip title="Search filters">
          <IconButton
            onClick={onToggleFilters}
            size="small"
            sx={{
              color: hasActiveFilters ? "#1976d2" : "text.secondary",
              "&:hover": {
                backgroundColor: "rgba(25, 118, 210, 0.04)",
              },
            }}
          >
            <FilterListIcon />
          </IconButton>
        </Tooltip>

        {hasActiveFilters && (
          <Tooltip title="Clear all filters">
            <IconButton
              onClick={onClearFilters}
              size="small"
              sx={{
                color: "text.secondary",
                "&:hover": {
                  backgroundColor: "rgba(0, 0, 0, 0.04)",
                },
              }}
            >
              <ClearIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  }

  // Full mode: show the complete filter interface
  return (
    <Box sx={{ mb: 2 }}>
      {/* Filter Controls */}
      <Collapse in={showFilters}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            p: 3,
            backgroundColor: "#f8f9fa",
            borderRadius: 2,
            border: "1px solid #e0e0e0",
          }}
        >
          {/* Publication Date Filters */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <CalendarTodayIcon sx={{ color: "#1976d2", fontSize: 20 }} />
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "#1976d2" }}
              >
                Publication Date
              </Typography>
            </Box>

            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 2,
                mb: 2,
              }}
            >
              {/* Year Range Slider */}
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography
                  variant="body2"
                  sx={{ mb: 1, color: "text.secondary" }}
                >
                  Year Range: {yearRange[0]} - {yearRange[1]}
                </Typography>
                <Slider
                  value={yearRange}
                  onChange={(_, newValue) =>
                    onYearRangeChange(newValue as [number, number])
                  }
                  valueLabelDisplay="auto"
                  min={1990}
                  max={new Date().getFullYear()}
                  step={1}
                  marks={[
                    { value: 1990, label: "1990" },
                    { value: 2010, label: "2010" },
                    {
                      value: new Date().getFullYear(),
                      label: new Date().getFullYear().toString(),
                    },
                  ]}
                  sx={{
                    color: "#1976d2",
                    "& .MuiSlider-thumb": {
                      backgroundColor: "#1976d2",
                    },
                    "& .MuiSlider-track": {
                      backgroundColor: "#1976d2",
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Citation Filters */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <TrendingUpIcon sx={{ color: "#1976d2", fontSize: 20 }} />
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "#1976d2" }}
              >
                Citation Count
              </Typography>
            </Box>

            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 2,
              }}
            >
              {/* Citation Range Slider */}
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography
                  variant="body2"
                  sx={{ mb: 1, color: "text.secondary" }}
                >
                  Citation Range: {citationRange[0]} - {citationRange[1]}+
                </Typography>
                <Slider
                  value={citationRange}
                  onChange={(_, newValue) =>
                    onCitationRangeChange(newValue as [number, number])
                  }
                  valueLabelDisplay="auto"
                  min={0}
                  max={10000}
                  step={100}
                  marks={[
                    { value: 0, label: "0" },
                    { value: 1000, label: "1K" },
                    { value: 5000, label: "5K" },
                    { value: 10000, label: "10K+" },
                  ]}
                  sx={{
                    color: "#1976d2",
                    "& .MuiSlider-thumb": {
                      backgroundColor: "#1976d2",
                    },
                    "& .MuiSlider-track": {
                      backgroundColor: "#1976d2",
                    },
                  }}
                />
              </Box>

              {/* Minimum Citations Input */}
              <Box sx={{ minWidth: 150 }}>
                <TextField
                  label="Min Citations"
                  type="number"
                  value={minCitations}
                  onChange={(e) =>
                    onMinCitationsChange(Number(e.target.value) || 0)
                  }
                  size="small"
                  fullWidth
                  inputProps={{ min: 0, step: 1 }}
                  helperText="Minimum citation count"
                />
              </Box>
            </Box>

            {/* Active Citation Filter Display */}
            {minCitations > 0 && (
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Filtering by:
                </Typography>
                <Chip
                  label={`Min Citations: ${minCitations}`}
                  size="small"
                  color="primary"
                  onDelete={() => onMinCitationsChange(0)}
                  sx={{ fontSize: "0.75rem" }}
                />
              </Box>
            )}
          </Box>

          {/* Actions */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              pt: 1,
              borderTop: "1px solid #e0e0e0",
            }}
          >
            <Button
              variant="outlined"
              size="small"
              onClick={onClearFilters}
              startIcon={<ClearIcon />}
              sx={{
                color: "text.secondary",
                borderColor: "#e0e0e0",
                "&:hover": {
                  borderColor: "#1976d2",
                  color: "#1976d2",
                },
              }}
            >
              Clear All Filters
            </Button>
            <Button
              variant="contained"
              size="small"
              color="primary"
              onClick={onApply}
              sx={{ fontWeight: 600 }}
            >
              Apply Filters
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

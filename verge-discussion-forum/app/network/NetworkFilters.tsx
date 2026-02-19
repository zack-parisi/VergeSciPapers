import React, { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

interface NetworkFiltersProps {
  onFiltersChange: (filters: NetworkFilters) => void;
  statusOptions: string[];
  schoolOptions: string[];
  degreeOptions: string[];
  interestOptions: string[];
}

export interface NetworkFilters {
  searchTerm: string;
  school: string;
  interests: string[];
  degree: string;
  status: string;
}

const NetworkFilters: React.FC<NetworkFiltersProps> = ({
  onFiltersChange,
  statusOptions,
  schoolOptions,
  degreeOptions,
  interestOptions,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [filters, setFilters] = useState<NetworkFilters>({
    searchTerm: "",
    school: "",
    interests: [],
    degree: "",
    status: "",
  });

  // Mobile filter dropdown state
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(
    null
  );
  const filterOpen = Boolean(filterAnchorEl);

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleFilterChange = (key: keyof NetworkFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      searchTerm: "",
      school: "",
      interests: [],
      degree: "",
      status: "",
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = Object.values(filters).some(
    (value) =>
      value && (Array.isArray(value) ? value.length > 0 : value !== "All")
  );

  // Count active filters for mobile display
  const activeFilterCount = [
    filters.status && filters.status !== "All" ? 1 : 0,
    filters.school && filters.school !== "All" ? 1 : 0,
    filters.degree && filters.degree !== "All" ? 1 : 0,
    filters.interests.length > 0 ? 1 : 0,
  ].reduce((sum, count) => sum + count, 0);

  // Mobile filter dropdown
  if (isMobile) {
    return (
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}
      >
        {/* Filter Button */}
        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={handleFilterClick}
          sx={{
            borderColor: hasActiveFilters ? "#1976d2" : "#ddd",
            color: hasActiveFilters ? "#1976d2" : "#666",
            fontWeight: hasActiveFilters ? 600 : 400,
            minWidth: "auto",
            px: 2,
            py: 1,
            fontSize: "0.875rem",
          }}
        >
          Filters
          {activeFilterCount > 0 && (
            <Chip
              label={activeFilterCount}
              size="small"
              sx={{
                ml: 1,
                bgcolor: "#1976d2",
                color: "white",
                fontSize: "0.7rem",
                height: 20,
                minWidth: 20,
              }}
            />
          )}
        </Button>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {filters.status && filters.status !== "All" && (
              <Chip
                label={`Status: ${filters.status}`}
                size="small"
                onDelete={() => handleFilterChange("status", "")}
                sx={{
                  bgcolor: "#f0f4fa",
                  color: "#1976d2",
                  fontSize: "0.75rem",
                }}
              />
            )}
            {filters.school && filters.school !== "All" && (
              <Chip
                label={`School: ${filters.school}`}
                size="small"
                onDelete={() => handleFilterChange("school", "")}
                sx={{
                  bgcolor: "#f0f4fa",
                  color: "#1976d2",
                  fontSize: "0.75rem",
                }}
              />
            )}
            {filters.degree && filters.degree !== "All" && (
              <Chip
                label={`Degree: ${filters.degree}`}
                size="small"
                onDelete={() => handleFilterChange("degree", "")}
                sx={{
                  bgcolor: "#f0f4fa",
                  color: "#1976d2",
                  fontSize: "0.75rem",
                }}
              />
            )}
            {filters.interests.map((interest, index) => (
              <Chip
                key={interest}
                label={interest}
                size="small"
                onDelete={() => {
                  const newInterests = filters.interests.filter(
                    (_, i) => i !== index
                  );
                  handleFilterChange("interests", newInterests);
                }}
                sx={{
                  bgcolor: "#f0f4fa",
                  color: "#1976d2",
                  fontSize: "0.75rem",
                }}
              />
            ))}
          </Box>
        )}

        {/* Clear All Button */}
        {hasActiveFilters && (
          <Button
            size="small"
            onClick={clearFilters}
            sx={{
              color: "#666",
              fontSize: "0.75rem",
              textTransform: "none",
              minWidth: "auto",
              px: 1,
            }}
          >
            Clear all
          </Button>
        )}

        {/* Filter Popover */}
        <Popover
          open={filterOpen}
          anchorEl={filterAnchorEl}
          onClose={handleFilterClose}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
          PaperProps={{
            sx: {
              width: "90vw",
              maxWidth: 400,
              mt: 1,
              p: 3,
              borderRadius: 2,
            },
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#1a1a1a" }}>
              Filters
            </Typography>

            {/* Status Filter */}
            <Autocomplete
              options={statusOptions}
              value={filters.status}
              onChange={(event, newValue) =>
                handleFilterChange("status", newValue || "")
              }
              renderInput={(params) => (
                <TextField {...params} label="Status" size="small" fullWidth />
              )}
            />

            {/* School Filter */}
            <Autocomplete
              options={schoolOptions}
              value={filters.school}
              onChange={(event, newValue) =>
                handleFilterChange("school", newValue || "")
              }
              renderInput={(params) => (
                <TextField {...params} label="School" size="small" fullWidth />
              )}
            />

            {/* Degree Filter */}
            <Autocomplete
              options={degreeOptions}
              value={filters.degree}
              onChange={(event, newValue) =>
                handleFilterChange("degree", newValue || "")
              }
              renderInput={(params) => (
                <TextField {...params} label="Degree" size="small" fullWidth />
              )}
            />

            {/* Interests Filter */}
            <Autocomplete
              multiple
              options={interestOptions}
              value={filters.interests}
              onChange={(event, newValue) =>
                handleFilterChange("interests", newValue || [])
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Interests"
                  size="small"
                  fullWidth
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={option}
                    size="small"
                    sx={{
                      bgcolor: "#f0f4fa",
                      color: "#1976d2",
                      fontWeight: 500,
                      fontSize: "0.7rem",
                    }}
                  />
                ))
              }
            />

            {/* Apply/Close Buttons */}
            <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleFilterClose}
                sx={{ flex: 1 }}
              >
                Apply Filters
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  clearFilters();
                  handleFilterClose();
                }}
                sx={{ flex: 1 }}
              >
                Clear All
              </Button>
            </Box>
          </Box>
        </Popover>
      </Box>
    );
  }

  // Desktop layout (unchanged)
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 2,
        alignItems: { xs: "stretch", md: "center" },
        flexWrap: "wrap",
      }}
    >
      {/* Status Filter */}
      <Autocomplete
        options={statusOptions}
        value={filters.status}
        onChange={(event, newValue) =>
          handleFilterChange("status", newValue || "")
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Status"
            size="small"
            sx={{ minWidth: { xs: "100%", md: 150 } }}
          />
        )}
        sx={{ minWidth: { xs: "100%", md: 150 } }}
      />

      {/* School Filter */}
      <Autocomplete
        options={schoolOptions}
        value={filters.school}
        onChange={(event, newValue) =>
          handleFilterChange("school", newValue || "")
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="School"
            size="small"
            sx={{ minWidth: { xs: "100%", md: 150 } }}
          />
        )}
        sx={{ minWidth: { xs: "100%", md: 150 } }}
      />

      {/* Degree Filter */}
      <Autocomplete
        options={degreeOptions}
        value={filters.degree}
        onChange={(event, newValue) =>
          handleFilterChange("degree", newValue || "")
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Degree"
            size="small"
            sx={{ minWidth: { xs: "100%", md: 150 } }}
          />
        )}
        sx={{ minWidth: { xs: "100%", md: 150 } }}
      />

      {/* Interests Filter */}
      <Autocomplete
        multiple
        options={interestOptions}
        value={filters.interests}
        onChange={(event, newValue) =>
          handleFilterChange("interests", newValue || [])
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Interests"
            size="small"
            sx={{ minWidth: { xs: "100%", md: 200 } }}
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option}
              label={option}
              size="small"
              sx={{
                bgcolor: "#f0f4fa",
                color: "#1976d2",
                fontWeight: 500,
                fontSize: "0.7rem",
              }}
            />
          ))
        }
        sx={{ minWidth: { xs: "100%", md: 200 } }}
      />

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <IconButton
          onClick={clearFilters}
          sx={{
            color: "#666",
            border: "1px solid #ddd",
            "&:hover": {
              bgcolor: "#f5f5f5",
            },
          }}
        >
          <ClearIcon />
        </IconButton>
      )}
    </Box>
  );
};

export default NetworkFilters;

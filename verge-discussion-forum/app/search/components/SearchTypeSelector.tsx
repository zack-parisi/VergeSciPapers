"use client";
import React, { useState, useMemo } from "react";
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Psychology as PsychologyIcon,
  Person as PersonIcon,
  Title as TitleIcon,
  MenuBook as MenuBookIcon,
} from "@mui/icons-material";
import { SubfieldSelector } from "./SubfieldSelector";
import { JournalSelector } from "./JournalSelector";

export type SearchType = "topics" | "authors" | "title" | "journals";

interface SearchTypeSelectorProps {
  searchType: SearchType;
  onSearchTypeChange: (type: SearchType) => void;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  selectedSubfields?: Array<{ id: string; name: string }>;
  onSubfieldAdd?: (subfield: { id: string; name: string }) => void;
  onSubfieldRemove?: (id: string) => void;
  selectedJournals?: Array<{ id: string; name: string }>;
  onJournalAdd?: (journal: { id: string; name: string }) => void;
  onJournalRemove?: (id: string) => void;
}

const searchTypeConfig = {
  topics: {
    label: "Neuroscience Topics",
    icon: <PsychologyIcon sx={{ fontSize: 20 }} />,
    placeholder: "Select neuroscience topics to search...",
    description: "Search by research areas and topics",
  },
  journals: {
    label: "Journals",
    icon: <MenuBookIcon sx={{ fontSize: 20 }} />,
    placeholder: "Select journals to search...",
    description: "Search by publication journals",
  },
  authors: {
    label: "Authors",
    icon: <PersonIcon sx={{ fontSize: 20 }} />,
    placeholder: 'Type author name (e.g., "John Smith")...',
    description: "Search by author names",
  },
  title: {
    label: "Paper Title",
    icon: <TitleIcon sx={{ fontSize: 20 }} />,
    placeholder: "Type keywords from paper title...",
    description: "Search by paper titles",
  },
};

export default function SearchTypeSelector({
  searchType,
  onSearchTypeChange,
  searchValue,
  onSearchValueChange,
  selectedSubfields = [],
  onSubfieldAdd,
  onSubfieldRemove,
  selectedJournals = [],
  onJournalAdd,
  onJournalRemove,
}: SearchTypeSelectorProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Mobile detection
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Default handlers for subfield and journal functions
  const handleSubfieldAdd = onSubfieldAdd || (() => {});
  const handleSubfieldRemove = onSubfieldRemove || (() => {});
  const handleJournalAdd = onJournalAdd || (() => {});
  const handleJournalRemove = onJournalRemove || (() => {});
  // Local state for input value (not debounced)
  const [inputValue, setInputValue] = useState(searchValue);

  // Update local state when searchValue changes externally
  React.useEffect(() => {
    setInputValue(searchValue);
  }, [searchValue]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleTypeSelect = (type: SearchType) => {
    onSearchTypeChange(type);
    onSearchValueChange(""); // Clear search value when changing types
    setInputValue(""); // Clear local input too
    handleClose();
  };

  // Handle search submission
  const handleSearchSubmit = () => {
    onSearchValueChange(inputValue);
  };

  // Handle Enter key press
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSearchSubmit();
    }
  };

  const currentConfig = searchTypeConfig[searchType];

  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 1 : 2,
          mb: 1,
        }}
      >
        {/* Search Type Dropdown - always on the left */}
        <Button
          variant="outlined"
          onClick={handleClick}
          endIcon={isMobile ? null : <ExpandMoreIcon />}
          startIcon={currentConfig.icon}
          sx={{
            minWidth: isMobile ? 50 : 200,
            width: isMobile ? 50 : "auto",
            justifyContent: "center",
            textTransform: "none",
            borderColor: "primary.main",
            color: "primary.main",
            px: isMobile ? 1 : 2,
            "&:hover": {
              borderColor: "primary.dark",
              backgroundColor: "primary.50",
            },
          }}
        >
          {isMobile ? "" : currentConfig.label}
        </Button>

        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          MenuListProps={{
            "aria-labelledby": "search-type-button",
          }}
          PaperProps={{
            sx: { minWidth: 250 },
          }}
        >
          {Object.entries(searchTypeConfig).map(([type, config]) => (
            <MenuItem
              key={type}
              onClick={() => handleTypeSelect(type as SearchType)}
              selected={searchType === type}
              sx={{ py: 1.5 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                {config.icon}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {config.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {config.description}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Menu>

        {/* Search Input - always on the right, different components based on type */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 0.5 : 1,
            flex: 1,
          }}
        >
          {searchType === "topics" ? (
            // For topics, show SubfieldSelector
            <Box sx={{ width: "100%" }}>
              <SubfieldSelector
                selectedSubfields={selectedSubfields}
                onSubfieldAdd={handleSubfieldAdd}
                onSubfieldRemove={handleSubfieldRemove}
                placeholder={
                  isMobile
                    ? "Select topics..."
                    : "Select neuroscience topics to search papers..."
                }
              />
            </Box>
          ) : searchType === "journals" ? (
            // For journals, show JournalSelector
            <Box sx={{ width: "100%" }}>
              <JournalSelector
                selectedJournals={selectedJournals}
                onJournalAdd={handleJournalAdd}
                onJournalRemove={handleJournalRemove}
                placeholder={
                  isMobile
                    ? "Select journals..."
                    : "Select journals to search papers..."
                }
              />
            </Box>
          ) : (
            // For authors and title, show active search input
            <>
              <TextField
                fullWidth
                variant="outlined"
                placeholder={
                  isMobile
                    ? searchType === "authors"
                      ? "Author name..."
                      : "Paper title..."
                    : currentConfig.placeholder
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <IconButton
                onClick={handleSearchSubmit}
                color="primary"
                size={isMobile ? "small" : "medium"}
                sx={{
                  bgcolor: "primary.main",
                  color: "white",
                  "&:hover": { bgcolor: "primary.dark" },
                }}
              >
                <SearchIcon />
              </IconButton>
            </>
          )}
        </Box>
      </Box>

      {/* Helper text */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 0.5, display: "block" }}
      >
        {currentConfig.description}
        {(searchType === "authors" || searchType === "title") &&
          " Press Enter or click search to find papers."}
      </Typography>
    </Box>
  );
}

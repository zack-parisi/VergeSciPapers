import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Box,
  TextField,
  Autocomplete,
  Chip,
  Typography,
  CircularProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { Search as SearchIcon, Clear as ClearIcon } from "@mui/icons-material";
import { useSubfieldSearch } from "../../hooks/useSubfieldSearch";

interface Subfield {
  id: string;
  name: string;
}

interface SubfieldSelectorProps {
  selectedSubfields: Subfield[];
  onSubfieldAdd: (subfield: Subfield) => void;
  onSubfieldRemove: (subfieldId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const SubfieldSelector: React.FC<SubfieldSelectorProps> = ({
  selectedSubfields,
  onSubfieldAdd,
  onSubfieldRemove,
  placeholder = "Search subfields...",
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  // Use the optimized subfield search hook
  const { subfields, loading, error, hasMore, loadMore, search, reset } =
    useSubfieldSearch({
      pageSize: 50,
      searchQuery,
      selectedSubfields,
    });

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue]);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setInputValue("");
      setSearchQuery("");
      reset();
    }
  }, [isOpen, reset]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, loadMore]);

  const handleInputChange = useCallback(
    (event: React.SyntheticEvent, value: string) => {
      setInputValue(value);
    },
    []
  );

  const handleOptionSelect = useCallback(
    (event: React.SyntheticEvent, value: Subfield | null) => {
      if (value) {
        onSubfieldAdd(value);
        setInputValue("");
      }
    },
    [onSubfieldAdd]
  );

  const handleChipDelete = useCallback(
    (subfieldId: string) => {
      onSubfieldRemove(subfieldId);
    },
    [onSubfieldRemove]
  );

  const handleClearAll = useCallback(() => {
    selectedSubfields.forEach((subfield) => {
      onSubfieldRemove(subfield.id);
    });
  }, [selectedSubfields, onSubfieldRemove]);

  return (
    <Box sx={{ width: "100%" }}>
      {/* Subfield Search Autocomplete */}
      <Autocomplete
        open={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onChange={handleOptionSelect}
        options={subfields}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        loading={loading}
        disabled={disabled}
        filterOptions={(x) => x} // Disable built-in filtering since we handle it server-side
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={placeholder}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {loading ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
                  </Box>
                  {params.InputProps.endAdornment}
                </InputAdornment>
              ),
            }}
          />
        )}
        renderOption={(props, option) => {
          const { key, ...otherProps } = props;
          return (
            <Box component="li" key={key} {...otherProps}>
              <Typography variant="body2">{option.name}</Typography>
            </Box>
          );
        }}
        noOptionsText={
          error ? (
            <Typography color="error" variant="body2">
              Error loading subfields: {error}
            </Typography>
          ) : loading ? (
            <Typography variant="body2">Loading...</Typography>
          ) : searchQuery ? (
            <Typography variant="body2">
              No subfields found for &quot;{searchQuery}&quot;
            </Typography>
          ) : (
            <Typography variant="body2">No subfields available</Typography>
          )
        }
        ListboxProps={{
          style: { maxHeight: 300 },
        }}
      />

      {/* Infinite Scroll Loading Indicator */}
      {hasMore && (
        <Box
          ref={loadingRef}
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            py: 1,
            mt: 1,
            height: 32, // Fixed height to prevent layout shifts
          }}
        >
          {loading && <CircularProgress size={20} />}
        </Box>
      )}
    </Box>
  );
};

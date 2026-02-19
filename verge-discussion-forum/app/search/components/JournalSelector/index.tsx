import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Autocomplete,
  TextField,
  Chip,
  Box,
  CircularProgress,
  Typography,
} from "@mui/material";
import { useJournalSearch } from "../../hooks/useJournalSearch";

interface Journal {
  id: string;
  name: string;
}

interface JournalSelectorProps {
  selectedJournals: Journal[];
  onJournalAdd: (journal: Journal) => void;
  onJournalRemove: (journalId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const JournalSelector: React.FC<JournalSelectorProps> = ({
  selectedJournals,
  onJournalAdd,
  onJournalRemove,
  placeholder = "Search journals...",
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const listboxRef = useRef<HTMLElement | null>(null);
  const previousJournalsLengthRef = useRef<number>(0);
  const scrollTopRef = useRef<number>(0);
  const isLoadingMoreRef = useRef<boolean>(false);

  // Use the optimized journal search hook
  const {
    journals,
    loading,
    error,
    hasMore,
    loadMore,
    search,
    reset,
    loadJournals,
  } = useJournalSearch({
    pageSize: 50,
    searchQuery,
    selectedJournals,
  });

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue]);

  // Reset search when dropdown closes and reload when it opens
  useEffect(() => {
    if (!isOpen) {
      setInputValue("");
      setSearchQuery("");
      reset();
    } else {
      // When dropdown opens, ensure we load the journals
      loadJournals(1, false);
    }
  }, [isOpen, reset, loadJournals]);

  const handleInputChange = useCallback(
    (event: React.SyntheticEvent, value: string) => {
      setInputValue(value);
    },
    []
  );

  const handleOptionSelect = useCallback(
    (event: React.SyntheticEvent, value: Journal | null) => {
      if (value) {
        onJournalAdd(value);
        setInputValue("");
      }
    },
    [onJournalAdd]
  );

  const handleChipDelete = useCallback(
    (journalId: string) => {
      onJournalRemove(journalId);
    },
    [onJournalRemove]
  );

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Custom option rendering with infinite scroll loading
  const renderOption = useCallback((props: any, option: Journal) => {
    return (
      <li {...props} key={option.id}>
        <Box sx={{ width: "100%" }}>
          <Typography variant="body2" noWrap>
            {option.name}
          </Typography>
        </Box>
      </li>
    );
  }, []);

  // Store the listbox ref for scroll management
  const setListboxRef = useCallback((node: HTMLElement | null) => {
    if (node) {
      listboxRef.current = node;
    }
  }, []);

  // Preserve scroll position when new journals are loaded
  useEffect(() => {
    if (
      journals.length > previousJournalsLengthRef.current &&
      listboxRef.current &&
      isLoadingMoreRef.current
    ) {
      // New journals were added during infinite scroll
      const scrollElement = listboxRef.current;
      const savedScrollTop = scrollTopRef.current;

      console.log(" Restoring scroll position:", {
        savedScrollTop,
        journalsLength: journals.length,
        previousLength: previousJournalsLengthRef.current,
      });

      // Restore the exact scroll position
      // Use multiple attempts to ensure it sticks
      const restoreScroll = () => {
        if (scrollElement) {
          scrollElement.scrollTop = savedScrollTop;
        }
      };

      // Immediate restore
      restoreScroll();

      // Delayed restore to handle async rendering
      setTimeout(restoreScroll, 10);
      setTimeout(restoreScroll, 50);
      setTimeout(restoreScroll, 100);

      isLoadingMoreRef.current = false;
    }
    previousJournalsLengthRef.current = journals.length;
  }, [journals.length]);

  // Handle scroll events for infinite loading
  const handleScroll = useCallback(
    (event: React.SyntheticEvent) => {
      const listboxNode = event.currentTarget as HTMLElement;

      // Always save the current scroll position
      scrollTopRef.current = listboxNode.scrollTop;

      if (
        listboxNode.scrollTop + listboxNode.clientHeight >=
          listboxNode.scrollHeight - 100 && // Load more when 100px from bottom
        hasMore &&
        !loading
      ) {
        console.log(" Scroll threshold reached, loading more journals...", {
          scrollTop: listboxNode.scrollTop,
          scrollHeight: listboxNode.scrollHeight,
          clientHeight: listboxNode.clientHeight,
        });

        // Mark that we're loading more to preserve scroll position
        isLoadingMoreRef.current = true;
        loadMore();
      }
    },
    [hasMore, loading, loadMore]
  );

  // Loading component for infinite scroll
  const ListboxComponent = React.useMemo(
    () =>
      React.forwardRef<HTMLDivElement, any>(
        function JournalListbox(props, ref) {
          const { children, ...other } = props;
          return (
            <div
              ref={(node) => {
                // Handle both the forwarded ref and our custom ref
                if (typeof ref === "function") {
                  ref(node);
                } else if (ref) {
                  ref.current = node;
                }
                setListboxRef(node);
              }}
              {...other}
            >
              {children}
              {loading && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    py: 2,
                  }}
                >
                  <CircularProgress size={20} />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Loading more journals...
                  </Typography>
                </Box>
              )}
              {!loading && hasMore && journals.length > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    py: 1,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Scroll for more...
                  </Typography>
                </Box>
              )}
              {error && (
                <Box sx={{ p: 2, textAlign: "center" }}>
                  <Typography variant="body2" color="error">
                    {error}
                  </Typography>
                </Box>
              )}
            </div>
          );
        }
      ),
    [loading, hasMore, journals.length, error, setListboxRef]
  );

  return (
    <Box sx={{ width: "100%" }}>
      {/* Journal Search Autocomplete */}
      <Autocomplete
        value={null}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onChange={handleOptionSelect}
        onOpen={handleOpen}
        onClose={handleClose}
        open={isOpen}
        disabled={disabled}
        options={journals}
        getOptionLabel={(option) =>
          typeof option === "string" ? option : option.name
        }
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderOption={renderOption}
        ListboxComponent={ListboxComponent}
        ListboxProps={{
          onScroll: handleScroll,
          style: { maxHeight: 400 }, // Set max height for scrolling
        }}
        loading={loading}
        noOptionsText={loading ? "Loading journals..." : "No journals found"}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={placeholder}
            variant="outlined"
            size="small"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        sx={{
          "& .MuiAutocomplete-inputRoot": {
            backgroundColor: "white",
          },
        }}
      />
    </Box>
  );
};

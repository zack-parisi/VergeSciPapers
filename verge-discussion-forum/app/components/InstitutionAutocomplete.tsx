import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Box,
  TextField,
  Autocomplete,
  Typography,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import { School as SchoolIcon } from "@mui/icons-material";

interface Institution {
  id: string;
  name: string;
  country?: string;
  types?: string[];
}

interface InstitutionAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  label?: string;
  required?: boolean;
}

export const InstitutionAutocomplete: React.FC<
  InstitutionAutocompleteProps
> = ({
  value,
  onChange,
  placeholder = "Search for your institution...",
  disabled = false,
  fullWidth = true,
  label = "School",
  required = false,
}) => {
  const [inputValue, setInputValue] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search institutions using ROR API
  const searchInstitutions = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setInstitutions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use ROR API directly with CORS proxy if needed, or create an API route
      const response = await fetch(
        `/api/institutions/search?query=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Failed to search institutions");
      }

      const data = await response.json();

      // Transform ROR API response to our Institution format
      const transformedInstitutions: Institution[] =
        data.items?.map((item: any) => {
          // Prioritize names in this order:
          // 1. English ror_display names
          // 2. English label names
          // 3. Any ror_display names
          // 4. Any label names
          // 5. First available name

          const names = item.names || [];

          const displayName =
            // 1. English ror_display
            names.find(
              (name: any) =>
                name.lang === "en" && name.types?.includes("ror_display")
            )?.value ||
            // 2. English label
            names.find(
              (name: any) => name.lang === "en" && name.types?.includes("label")
            )?.value ||
            // 3. Any ror_display
            names.find((name: any) => name.types?.includes("ror_display"))
              ?.value ||
            // 4. Any label
            names.find((name: any) => name.types?.includes("label"))?.value ||
            // 5. First available name
            names[0]?.value ||
            "Unknown Institution";

          return {
            id: item.id,
            name: displayName,
            country: item.locations?.[0]?.geonames_details?.country_name,
            types: item.types,
          };
        }) || [];

      setInstitutions(transformedInstitutions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setInstitutions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchInstitutions(inputValue);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [inputValue, searchInstitutions]);

  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const handleInputChange = useCallback(
    (event: React.SyntheticEvent, newInputValue: string) => {
      setInputValue(newInputValue);
    },
    []
  );

  const handleOptionSelect = useCallback(
    (event: React.SyntheticEvent, value: string | Institution | null) => {
      if (value) {
        if (typeof value === "string") {
          onChange(value);
          setInputValue(value);
        } else {
          onChange(value.name);
          setInputValue(value.name);
        }
      }
    },
    [onChange]
  );

  const handleBlur = useCallback(() => {
    // If user typed something but didn't select from dropdown, use their input
    if (inputValue && inputValue !== value) {
      onChange(inputValue);
    }
  }, [inputValue, value, onChange]);

  return (
    <Autocomplete
      open={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={handleOptionSelect}
      options={institutions}
      getOptionLabel={(option) => {
        if (typeof option === "string") return option;
        return option.name;
      }}
      isOptionEqualToValue={(option, value) => {
        if (typeof option === "string" || typeof value === "string") {
          return option === value;
        }
        return option.id === value.id;
      }}
      loading={loading}
      disabled={disabled}
      fullWidth={fullWidth}
      freeSolo
      clearOnEscape
      selectOnFocus
      filterOptions={(x) => x} // Disable built-in filtering since we handle it server-side
      renderInput={(params) => (
        <TextField
          {...params}
          label={required ? `${label} *` : label}
          placeholder={placeholder}
          onBlur={handleBlur}
          error={!!error}
          helperText={error}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SchoolIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
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
            <Box
              sx={{ display: "flex", flexDirection: "column", width: "100%" }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {option.name}
              </Typography>
              {option.country && (
                <Typography variant="caption" color="text.secondary">
                  {option.country}
                </Typography>
              )}
            </Box>
          </Box>
        );
      }}
      noOptionsText={
        error ? (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        ) : loading ? (
          <Typography variant="body2">Searching institutions...</Typography>
        ) : inputValue.length < 2 ? (
          <Typography variant="body2">
            Type at least 2 characters to search
          </Typography>
        ) : (
          <Typography variant="body2">
            No institutions found for &quot;{inputValue}&quot;
          </Typography>
        )
      }
      ListboxProps={{
        style: { maxHeight: 300 },
      }}
    />
  );
};

"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";
import { SubfieldSelector } from "../search/components/SubfieldSelector";

interface Subfield {
  id: string;
  name: string;
}

interface ResearchInterestsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (interests: Subfield[]) => void;
  loading?: boolean;
  initialInterests?: Subfield[];
  isFirstTime?: boolean;
}

export default function ResearchInterestsModal({
  open,
  onClose,
  onSave,
  loading = false,
  initialInterests = [],
  isFirstTime = false,
}: ResearchInterestsModalProps) {
  const [selectedInterests, setSelectedInterests] =
    useState<Subfield[]>(initialInterests);
  const [error, setError] = useState<string | null>(null);

  // Reset selected interests when modal opens with new initial interests
  useEffect(() => {
    if (open) {
      setSelectedInterests(initialInterests);
      setError(null);
    }
  }, [open, initialInterests]);

  const handleAddInterest = (subfield: Subfield) => {
    setSelectedInterests((prev) => [...prev, subfield]);
  };

  const handleRemoveInterest = (subfieldId: string) => {
    setSelectedInterests((prev) =>
      prev.filter((interest) => interest.id !== subfieldId)
    );
  };

  const handleSave = () => {
    setError(null);
    onSave(selectedInterests);
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
          {isFirstTime
            ? "Welcome! Select Your Research Interests"
            : "Edit Research Interests"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {isFirstTime
            ? "Help us personalize your experience by selecting your research areas of interest. (Optional)"
            : "Update your research interests to improve content recommendations. (Optional)"}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Search and Select Research Areas
          </Typography>
          <SubfieldSelector
            selectedSubfields={selectedInterests}
            onSubfieldAdd={handleAddInterest}
            onSubfieldRemove={handleRemoveInterest}
            placeholder="Search for research areas..."
            disabled={loading}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        {!isFirstTime && (
          <Button onClick={handleClose} disabled={loading} color="inherit">
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading
            ? "Saving..."
            : isFirstTime
              ? "Continue (Optional)"
              : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

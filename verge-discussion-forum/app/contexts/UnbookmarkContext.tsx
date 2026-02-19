"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface UnbookmarkContextType {
  showUnbookmarkConfirmation: (item: {
    id: number | string;
    title: string;
    type: string;
    onConfirm: () => Promise<void>;
  }) => void;
}

const UnbookmarkContext = createContext<UnbookmarkContextType | undefined>(
  undefined
);

interface UnbookmarkProviderProps {
  children: ReactNode;
}

export function UnbookmarkProvider({ children }: UnbookmarkProviderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemToUnbookmark, setItemToUnbookmark] = useState<{
    id: number | string;
    title: string;
    type: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const showUnbookmarkConfirmation = (item: {
    id: number | string;
    title: string;
    type: string;
    onConfirm: () => Promise<void>;
  }) => {
    console.log(" showUnbookmarkConfirmation called with:", item);
    setItemToUnbookmark(item);
    setDialogOpen(true);
    console.log(" Dialog state updated:", {
      itemToUnbookmark: item,
      dialogOpen: true,
    });
  };

  const handleConfirm = async () => {
    if (itemToUnbookmark) {
      try {
        await itemToUnbookmark.onConfirm();
        setDialogOpen(false);
        setItemToUnbookmark(null);
      } catch (error) {
        console.error("Error during unbookmark:", error);
        // Keep dialog open on error so user can retry
      }
    }
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setItemToUnbookmark(null);
  };

  return (
    <UnbookmarkContext.Provider value={{ showUnbookmarkConfirmation }}>
      {children}

      {/* Global Unbookmark Confirmation Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCancel}
        aria-labelledby="global-unbookmark-dialog-title"
        aria-describedby="global-unbookmark-dialog-description"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="global-unbookmark-dialog-title">
          Remove from Saved?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="global-unbookmark-dialog-description">
            Are you sure you want to remove this {itemToUnbookmark?.type} from
            your saved items?
          </DialogContentText>
          {itemToUnbookmark && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                bgcolor: "#f5f5f5",
                borderRadius: 1,
                border: "1px solid #e0e0e0",
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: "#333",
                  lineHeight: 1.4,
                }}
              >
                &ldquo;{itemToUnbookmark.title}&rdquo;
              </Typography>
            </Box>
          )}
          <DialogContentText
            sx={{ mt: 2, fontSize: "0.875rem", color: "#666" }}
          >
            This action cannot be undone. Your notes for this{" "}
            {itemToUnbookmark?.type} will also be deleted. You can bookmark this{" "}
            {itemToUnbookmark?.type} again later if needed.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleCancel}
            variant="outlined"
            sx={{
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            color="error"
            sx={{
              textTransform: "none",
              fontWeight: 500,
              bgcolor: "#d32f2f",
              "&:hover": {
                bgcolor: "#b71c1c",
              },
            }}
          >
            Remove from Saved
          </Button>
        </DialogActions>
      </Dialog>
    </UnbookmarkContext.Provider>
  );
}

export function useUnbookmarkConfirmation() {
  const context = useContext(UnbookmarkContext);
  if (context === undefined) {
    throw new Error(
      "useUnbookmarkConfirmation must be used within an UnbookmarkProvider"
    );
  }
  return context;
}

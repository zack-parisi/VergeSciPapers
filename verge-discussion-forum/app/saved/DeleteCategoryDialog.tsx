import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box"; // Added Box import

interface DeleteCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  loading: boolean;
  categoryName: string;
}

const DeleteCategoryDialog: React.FC<DeleteCategoryDialogProps> = ({
  open,
  onClose,
  onDelete,
  loading,
  categoryName,
}) => (
  <>
    {/* Custom backdrop that covers everything including sticky top bar */}
    {open && (
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          bgcolor: "rgba(0, 0, 0, 0.6)",
          zIndex: 3999, // Higher than sticky top bar (2001) but lower than dialog
        }}
        onClick={onClose}
      />
    )}
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      sx={{
        zIndex: 5000, // Higher than the custom backdrop (3999)
        "& .MuiDialog-paper": {
          zIndex: 5000, // Higher than the custom backdrop (3999)
          position: "relative",
          bgcolor: "#fff", // Ensure white background
        },
        "& .MuiBackdrop-root": {
          display: "none", // Hide the default backdrop since we're using custom one
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, color: "#d32f2f" }}>
        Delete Project
      </DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete the project <b>{categoryName}</b>?
          This cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={onDelete}
          color="error"
          variant="contained"
          disabled={loading}
        >
          {loading ? "Deleting..." : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  </>
);

export default DeleteCategoryDialog;

import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

interface CategoryModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  loading: boolean;
  error: string;
  value: string;
  onChange: (v: string) => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({
  open,
  onClose,
  onCreate,
  loading,
  error,
  value,
  onChange,
}) => {
  if (!open) return null;
  return (
    <>
      {/* Custom backdrop that covers the entire viewport */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          bgcolor: "rgba(0, 0, 0, 0.5)",
          zIndex: 12000,
        }}
        onClick={onClose}
      />
      {/* Modal content */}
      <Box
        sx={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          bgcolor: "#fff",
          borderRadius: "12px",
          minWidth: 380,
          p: 0,
          zIndex: 13000,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <Box
          sx={{
            bgcolor: "#1976d2",
            color: "#fff",
            px: 3,
            py: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 1 }}>
            Create New Project
          </Typography>
        </Box>
        <Box
          sx={{
            p: 3,
            pt: 2,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <TextField
            autoFocus
            label="Category Name"
            type="text"
            fullWidth
            value={value}
            onChange={(e) => onChange(e.target.value)}
            error={!!error}
            helperText={error}
            InputProps={{
              sx: {
                bgcolor: "#f5f8fd",
                borderRadius: 2,
                fontSize: 18,
                color: "#181c24",
                boxShadow: "none",
              },
            }}
            InputLabelProps={{ sx: { color: "#1976d2", fontWeight: 600 } }}
          />
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 2,
              mt: 2,
            }}
          >
            <Button
              onClick={onClose}
              variant="outlined"
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                color: "#1976d2",
                borderColor: "#1976d2",
                px: 3,
                py: 1,
                "&:hover": { bgcolor: "#e3f0fd" },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              disabled={loading}
              variant="contained"
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                bgcolor: "#1976d2",
                color: "#fff",
                px: 3,
                py: 1,
                boxShadow: "none",
                "&:hover": { bgcolor: "#1251a3" },
              }}
            >
              {loading ? "Creating..." : "Create"}
            </Button>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default CategoryModal;

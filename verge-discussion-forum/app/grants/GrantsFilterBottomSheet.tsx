import React from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";

interface GrantsFilterBottomSheetProps {
  open: boolean;
  onClose: () => void;
  searchTitle: string;
  setSearchTitle: (v: string) => void;
  minFunding: string;
  setMinFunding: (v: string) => void;
  deadline: string;
  setDeadline: (v: string) => void;
  statusFilter: "all" | "federal" | "private";
  setStatusFilter: (v: "all" | "federal" | "private") => void;
  onApply?: () => void;
}

const GrantsFilterBottomSheet: React.FC<GrantsFilterBottomSheetProps> = ({
  open,
  onClose,
  searchTitle,
  setSearchTitle,
  minFunding,
  setMinFunding,
  deadline,
  setDeadline,
  statusFilter,
  setStatusFilter,
  onApply,
}) => {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          minHeight: 320,
          maxHeight: "80vh",
          p: 0,
        },
      }}
    >
      <Box
        sx={{ p: 2, pb: 3, display: "flex", flexDirection: "column", gap: 2 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Typography
            variant="h6"
            sx={{ flex: 1, color: "#1976d2", fontWeight: 700 }}
          >
            Filter Grants
          </Typography>
          <IconButton onClick={onClose} sx={{ ml: 1 }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <TextField
          variant="outlined"
          placeholder="Search by title..."
          fullWidth
          value={searchTitle}
          onChange={(e) => setSearchTitle(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#1976d2" }} />
              </InputAdornment>
            ),
            sx: {
              borderRadius: 2,
              bgcolor: "#fff",
            },
          }}
          sx={{
            borderRadius: 2,
            bgcolor: "#fff",
            "& .MuiOutlinedInput-root": { borderRadius: 2 },
          }}
        />
        <TextField
          variant="outlined"
          type="number"
          placeholder="Min funding ($)"
          fullWidth
          value={minFunding}
          onChange={(e) => setMinFunding(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <AttachMoneyIcon sx={{ color: "#1976d2" }} />
              </InputAdornment>
            ),
            sx: {
              borderRadius: 2,
              bgcolor: "#fff",
            },
          }}
          inputProps={{ min: 0 }}
          sx={{
            borderRadius: 2,
            bgcolor: "#fff",
            "& .MuiOutlinedInput-root": { borderRadius: 2 },
          }}
        />
        <TextField
          variant="outlined"
          type="date"
          placeholder="Deadline before..."
          fullWidth
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <svg
                  width="1em"
                  height="1em"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="18"
                    rx="2"
                    stroke="#1976d2"
                    strokeWidth="2"
                  />
                  <path
                    d="M16 2v4M8 2v4M3 10h18"
                    stroke="#1976d2"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </InputAdornment>
            ),
            sx: {
              borderRadius: 2,
              bgcolor: "#fff",
            },
          }}
          sx={{
            borderRadius: 2,
            bgcolor: "#fff",
            "& .MuiOutlinedInput-root": { borderRadius: 2 },
          }}
        />
        {/* Filter by Status (Federal/Private) */}
        <Box>
          <Typography
            variant="subtitle2"
            sx={{ mb: 1, color: "#666", fontWeight: 600 }}
          >
            Grant Type
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant={statusFilter === "all" ? "contained" : "outlined"}
              size="small"
              onClick={() => setStatusFilter("all")}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
                flex: 1,
              }}
            >
              All
            </Button>
            <Button
              variant={statusFilter === "federal" ? "contained" : "outlined"}
              size="small"
              onClick={() => setStatusFilter("federal")}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
                flex: 1,
              }}
            >
              Federal
            </Button>
            <Button
              variant={statusFilter === "private" ? "contained" : "outlined"}
              size="small"
              onClick={() => setStatusFilter("private")}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
                flex: 1,
              }}
            >
              Private
            </Button>
          </Box>
        </Box>
        {onApply && (
          <Button
            variant="contained"
            color="primary"
            fullWidth
            sx={{
              mt: 2,
              fontWeight: 700,
              borderRadius: 2,
              py: 1,
              fontSize: 16,
            }}
            onClick={onApply}
          >
            Apply Filters
          </Button>
        )}
      </Box>
    </Drawer>
  );
};

export default GrantsFilterBottomSheet;

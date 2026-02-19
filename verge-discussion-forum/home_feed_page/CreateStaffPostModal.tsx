import React, { useState } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import Chip from "@mui/material/Chip";

interface StaffPostFormData {
  title: string;
  authors: string[];
  publicationDate: Date | null;
  citedByCount: number;
  abstract: string;
  doi: string;
  linkId: string;
  subfields: string[];
}

interface CreateStaffPostModalProps {
  open: boolean;
  onClose: () => void;
  onPost: (data: StaffPostFormData) => Promise<void>;
  posting: boolean;
  error: string | null;
}

const CreateStaffPostModal: React.FC<CreateStaffPostModalProps> = ({
  open,
  onClose,
  onPost,
  posting,
  error,
}) => {
  const [formData, setFormData] = useState<StaffPostFormData>({
    title: "",
    authors: [],
    publicationDate: null,
    citedByCount: 0,
    abstract: "",
    doi: "",
    linkId: "",
    subfields: [],
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [authorInput, setAuthorInput] = useState("");
  const [subfieldInput, setSubfieldInput] = useState("");

  const handleInputChange = (field: keyof StaffPostFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (localError) setLocalError(null);
  };

  const handleAddAuthor = () => {
    if (authorInput.trim() && !formData.authors.includes(authorInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        authors: [...prev.authors, authorInput.trim()],
      }));
      setAuthorInput("");
    }
  };
  const handleRemoveAuthor = (author: string) => {
    setFormData((prev) => ({
      ...prev,
      authors: prev.authors.filter((a) => a !== author),
    }));
  };
  const handleAddSubfield = () => {
    if (
      subfieldInput.trim() &&
      !formData.subfields.includes(subfieldInput.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        subfields: [...prev.subfields, subfieldInput.trim()],
      }));
      setSubfieldInput("");
    }
  };
  const handleRemoveSubfield = (subfield: string) => {
    setFormData((prev) => ({
      ...prev,
      subfields: prev.subfields.filter((s) => s !== subfield),
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setLocalError("Title is required");
      return false;
    }
    if (!formData.abstract.trim()) {
      setLocalError("Abstract is required");
      return false;
    }
    return true;
  };

  const handlePost = async () => {
    if (!validateForm()) return;
    setLocalError(null);
    await onPost(formData);
    setFormData({
      title: "",
      authors: [],
      publicationDate: null,
      citedByCount: 0,
      abstract: "",
      doi: "",
      linkId: "",
      subfields: [],
    });
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          bgcolor: "rgba(0,0,0,0.7)",
          zIndex: 2100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            bgcolor: "white",
            color: "#181c24",
            borderRadius: 4,
            width: 600,
            maxWidth: "95vw",
            maxHeight: "90vh",
            p: 0,
            boxShadow: 6,
            display: "flex",
            flexDirection: "column",
            gap: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Close button */}
          <Box
            sx={{ display: "flex", justifyContent: "flex-end", p: 2, pb: 0 }}
          >
            <IconButton
              onClick={onClose}
              sx={{ color: "#888" }}
              aria-label="Close"
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Form content */}
          <Box
            sx={{
              px: 3,
              pt: 1,
              pb: 3,
              overflowY: "auto",
              maxHeight: "calc(90vh - 80px)",
            }}
          >
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, mb: 3, color: "#1976d2" }}
            >
              Post a Staff Article
            </Typography>
            {/* Title */}
            <TextField
              label="Title"
              variant="outlined"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              fullWidth
              disabled={posting}
              sx={{ mb: 2 }}
              InputProps={{
                sx: {
                  bgcolor: "#f5f5f5",
                  color: "#181c24",
                  borderRadius: 2,
                  fontSize: 16,
                },
              }}
            />
            {/* Authors */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Authors
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <TextField
                  value={authorInput}
                  onChange={(e) => setAuthorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddAuthor();
                  }}
                  placeholder="Add author and press Enter"
                  size="small"
                  disabled={posting}
                  sx={{ flex: 1 }}
                />
                <Button
                  onClick={handleAddAuthor}
                  disabled={posting || !authorInput.trim()}
                >
                  Add
                </Button>
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {formData.authors.map((author) => (
                  <Chip
                    key={author}
                    label={author}
                    onDelete={() => handleRemoveAuthor(author)}
                    sx={{ bgcolor: "#e3f0fd", color: "#1976d2" }}
                  />
                ))}
              </Box>
            </Box>
            {/* Publication Date */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Publication Date"
                value={formData.publicationDate}
                onChange={(date) => handleInputChange("publicationDate", date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    sx: { mb: 2 },
                    disabled: posting,
                  },
                }}
              />
            </LocalizationProvider>
            {/* Cited By Count */}
            <TextField
              label="Cited By Count"
              type="number"
              value={formData.citedByCount}
              onChange={(e) =>
                handleInputChange("citedByCount", parseInt(e.target.value) || 0)
              }
              fullWidth
              disabled={posting}
              sx={{ mb: 2 }}
              InputProps={{
                sx: {
                  bgcolor: "#f5f5f5",
                  color: "#181c24",
                  borderRadius: 2,
                  fontSize: 16,
                },
              }}
            />
            {/* Abstract */}
            <TextField
              label="Abstract"
              variant="outlined"
              multiline
              minRows={3}
              maxRows={8}
              value={formData.abstract}
              onChange={(e) => handleInputChange("abstract", e.target.value)}
              fullWidth
              disabled={posting}
              sx={{ mb: 2 }}
              InputProps={{
                sx: {
                  bgcolor: "#f5f5f5",
                  color: "#181c24",
                  borderRadius: 2,
                  fontSize: 16,
                },
              }}
            />
            {/* DOI */}
            <TextField
              label="DOI (URL)"
              variant="outlined"
              value={formData.doi}
              onChange={(e) => handleInputChange("doi", e.target.value)}
              fullWidth
              disabled={posting}
              sx={{ mb: 2 }}
              InputProps={{
                sx: {
                  bgcolor: "#f5f5f5",
                  color: "#181c24",
                  borderRadius: 2,
                  fontSize: 16,
                },
              }}
            />
            {/* Link ID */}
            <TextField
              label="Link ID (URL)"
              variant="outlined"
              value={formData.linkId}
              onChange={(e) => handleInputChange("linkId", e.target.value)}
              fullWidth
              disabled={posting}
              sx={{ mb: 2 }}
              InputProps={{
                sx: {
                  bgcolor: "#f5f5f5",
                  color: "#181c24",
                  borderRadius: 2,
                  fontSize: 16,
                },
              }}
            />
            {/* Subfields */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Subfields
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <TextField
                  value={subfieldInput}
                  onChange={(e) => setSubfieldInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSubfield();
                  }}
                  placeholder="Add subfield and press Enter"
                  size="small"
                  disabled={posting}
                  sx={{ flex: 1 }}
                />
                <Button
                  onClick={handleAddSubfield}
                  disabled={posting || !subfieldInput.trim()}
                >
                  Add
                </Button>
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {formData.subfields.map((subfield) => (
                  <Chip
                    key={subfield}
                    label={subfield}
                    onDelete={() => handleRemoveSubfield(subfield)}
                    sx={{ bgcolor: "#e3f0fd", color: "#1976d2" }}
                  />
                ))}
              </Box>
            </Box>
            {(localError || error) && (
              <Typography color="error" sx={{ mb: 1, fontSize: 15 }}>
                {localError || error}
              </Typography>
            )}
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                sx={{ fontWeight: 600, fontSize: 16, px: 4 }}
                onClick={handlePost}
                disabled={posting}
              >
                {posting ? "Posting..." : "Post"}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default CreateStaffPostModal;

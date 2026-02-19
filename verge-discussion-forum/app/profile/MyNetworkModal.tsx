import React, { useState, useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useConnections } from "./useConnections";
import Link from "next/link";
import Avatar from "@mui/material/Avatar";

interface MyNetworkModalProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
}

const MyNetworkModal: React.FC<MyNetworkModalProps> = ({
  open,
  onClose,
  userId,
}) => {
  const { connections, loading, error } = useConnections(userId);
  const [search, setSearch] = useState("");

  const filteredConnections = useMemo(() => {
    if (!search) return connections;
    const lower = search.toLowerCase();
    return connections.filter(
      (c: any) =>
        (c.firstName && c.firstName.toLowerCase().includes(lower)) ||
        (c.lastName && c.lastName.toLowerCase().includes(lower))
    );
  }, [connections, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        My Connect
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ minHeight: 400, p: 3 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by name"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
          sx={{ mb: 3 }}
        />
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : filteredConnections.length === 0 ? (
          <Typography color="text.secondary">No connections found.</Typography>
        ) : (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              maxHeight: 350,
              overflowY: "auto",
            }}
          >
            {filteredConnections.map((c: any) => {
              const avatarLetter = c.firstName
                ? c.firstName[0].toUpperCase()
                : c.lastName
                  ? c.lastName[0].toUpperCase()
                  : c.id
                    ? c.id[0].toUpperCase()
                    : "?";
              return (
                <Box
                  key={c.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    bgcolor: "#f5faff",
                    border: "1.5px solid #b6d0ee",
                    borderRadius: 2,
                    p: 2,
                    gap: 2,
                  }}
                >
                  <Avatar
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: "#1976d2",
                      fontWeight: 700,
                      fontSize: 22,
                    }}
                  >
                    {avatarLetter}
                  </Avatar>
                  <Box>
                    <Link href={`/profile/${c.id}`}>
                      <Typography
                        fontWeight={700}
                        fontSize={16}
                        color="#181c24"
                        sx={{
                          cursor: "pointer",
                          textDecoration: "underline",
                          "&:hover": { color: "#1976d2" },
                        }}
                      >
                        {c.firstName} {c.lastName}
                      </Typography>
                    </Link>
                    {c.school && (
                      <Typography fontSize={14} color="#1976d2">
                        {c.school}
                      </Typography>
                    )}
                    {c.degree && (
                      <Typography fontSize={13} color="#1976d2">
                        {c.degree}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MyNetworkModal;

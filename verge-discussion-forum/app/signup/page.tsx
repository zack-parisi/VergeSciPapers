"use client";
import React, { useState } from "react";
import Image from "next/image";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import InfoIcon from "@mui/icons-material/Info";
import Alert from "@mui/material/Alert";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setToken(null);
    if (form.password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mongodb/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setToken(data.token);
      setLoading(false);
    } catch (e) {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        flexDirection: "column",
        px: 2,
        pt: { xs: 6, sm: 10, md: 12 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Image
          src="/vergesci_logo.jpeg"
          alt="VergeSci Logo"
          width={80}
          height={80}
          style={{ borderRadius: 16, marginBottom: 12 }}
        />
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            color: "#1976d2",
            letterSpacing: 2,
            mb: 1,
            textAlign: "center",
          }}
          style={{ color: "#000" }}
        >
          VergeSci
        </Typography>
      </Box>
      <Box
        sx={{
          width: "100%",
          maxWidth: 400,
          bgcolor: "#fff",
          borderRadius: 4,
          boxShadow: "0 4px 32px rgba(25, 118, 210, 0.10)",
          p: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: "#181c24", mb: 3, textAlign: "center" }}
        >
          Sign Up
        </Typography>

        {/* Information Alert */}
        <Alert
          severity="info"
          icon={<InfoIcon />}
          sx={{
            mb: 3,
            width: "100%",
            "& .MuiAlert-message": {
              fontSize: "14px",
              lineHeight: 1.4,
            },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            Account Types
          </Typography>
          <Typography variant="body2" sx={{ fontSize: "13px" }}>
            • <strong>.edu emails:</strong> Can post comments and reposts
          </Typography>
          <Typography variant="body2" sx={{ fontSize: "13px" }}>
            • <strong>Other emails:</strong> Can like, save, and bookmark
            content
          </Typography>
        </Alert>

        {success ? (
          <Box sx={{ textAlign: "center" }}>
            <Typography sx={{ color: "green", mb: 1 }}>
              Registration successful!
            </Typography>
            <Typography sx={{ color: "green", mb: 1 }}>
              Check your email for a verification link.
            </Typography>
          </Box>
        ) : (
          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <TextField
              label="First Name"
              name="firstName"
              type="text"
              value={form.firstName}
              onChange={handleChange}
              fullWidth
              required
              sx={{ mb: 2 }}
              autoComplete="given-name"
            />
            <TextField
              label="Last Name"
              name="lastName"
              type="text"
              value={form.lastName}
              onChange={handleChange}
              fullWidth
              required
              sx={{ mb: 2 }}
              autoComplete="family-name"
            />
            <TextField
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              fullWidth
              required
              sx={{ mb: 2 }}
              autoComplete="email"
            />
            <TextField
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              fullWidth
              required
              sx={{ mb: 2 }}
              autoComplete="new-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((show) => !show)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Confirm Password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              autoComplete="new-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowConfirmPassword((show) => !show)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {error && (
              <Typography color="error" sx={{ mb: 2, fontSize: 15 }}>
                {error}
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
              sx={{
                fontWeight: 700,
                fontSize: 17,
                borderRadius: 2,
                py: 1.5,
                mt: 1,
                boxShadow: "0 2px 8px rgba(25, 118, 210, 0.10)",
              }}
              startIcon={loading ? <CircularProgress size={18} /> : null}
            >
              {loading ? "Registering..." : "Sign Up"}
            </Button>
          </form>
        )}
      </Box>
    </Box>
  );
}

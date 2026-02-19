"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send reset email");
      } else {
        setSuccess(true);
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#f5f5f5",
        }}
      >
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
            sx={{ fontWeight: 700, color: "green", mb: 2 }}
          >
            Check Your Email
          </Typography>
          <Alert severity="success" sx={{ mb: 3, width: "100%" }}>
            If an account with that email exists, we&apos;ve sent you a password
            reset link.
          </Alert>
          <Typography sx={{ textAlign: "center", mb: 3, color: "#666" }}>
            Please check your email and click the link to reset your password.
            The link will expire in 24 hours.
          </Typography>
          <Button
            href="/login"
            variant="contained"
            color="primary"
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Back to Login
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f5f5f5",
      }}
    >
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
          Forgot Your Password?
        </Typography>

        <Typography sx={{ textAlign: "center", mb: 3, color: "#666" }}>
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </Typography>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
            autoComplete="email"
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
            sx={{ fontWeight: 700, borderRadius: 2, mb: 2 }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Send Reset Link"
            )}
          </Button>

          <Button
            href="/login"
            variant="text"
            color="primary"
            fullWidth
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Back to Login
          </Button>
        </form>
      </Box>
    </Box>
  );
}

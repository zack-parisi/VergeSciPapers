"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";

export default function ResendVerificationPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send verification email");
      } else {
        setSuccess(true);
      }
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f5f5f5",
        p: 2,
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
          Resend Verification Email
        </Typography>

        {!success ? (
          <>
            <Typography sx={{ textAlign: "center", mb: 3, color: "#666" }}>
              Didn&apos;t receive your verification email? Enter your email
              address below and we&apos;ll send you a new one.
            </Typography>

            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{ width: "100%" }}
            >
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                sx={{ mb: 3 }}
                disabled={loading}
              />

              {error && (
                <Typography
                  sx={{ color: "#d32f2f", mb: 2, textAlign: "center" }}
                >
                  {error}
                </Typography>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading || !email}
                sx={{
                  fontWeight: 700,
                  borderRadius: 2,
                  mb: 2,
                  height: 48,
                }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Send Verification Email"
                )}
              </Button>
            </Box>
          </>
        ) : (
          <Box sx={{ textAlign: "center", color: "green" }}>
            <Typography sx={{ fontWeight: 700, mb: 2 }}>
              Verification email sent!
            </Typography>
            <Typography sx={{ mb: 3, color: "#666" }}>
              Please check your email and click the verification link. If you
              don&apos;t see it, check your spam folder.
            </Typography>
            <Button
              onClick={() => setSuccess(false)}
              variant="outlined"
              sx={{ fontWeight: 700, borderRadius: 2, mr: 2 }}
            >
              Send Another
            </Button>
            <Button
              href="/login"
              variant="contained"
              color="primary"
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Go to Login
            </Button>
          </Box>
        )}

        <Box sx={{ mt: 3, textAlign: "center" }}>
          <Link href="/login" sx={{ color: "#1976d2", textDecoration: "none" }}>
            Back to Login
          </Link>
        </Box>
      </Box>
    </Box>
  );
}

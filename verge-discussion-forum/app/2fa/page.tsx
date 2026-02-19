"use client";
import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

function TwoFAContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mongodb/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, remember }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Invalid code");
        setLoading(false);
        return;
      }
      // On success, redirect to /profile (or dashboard)
      router.push("/profile");
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#fff",
      }}
    >
      <Box
        sx={{
          width: 350,
          bgcolor: "#fff",
          borderRadius: 4,
          boxShadow: "0 4px 32px rgba(25, 118, 210, 0.10)",
          p: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          Two-Factor Authentication
        </Typography>
        <Typography
          sx={{ mb: 2, color: "#555", fontSize: 15, textAlign: "center" }}
        >
          Enter the 6-digit code sent to your email.
        </Typography>
        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <TextField
            label="Verification Code"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            fullWidth
            required
            sx={{ mb: 2 }}
            inputProps={{
              maxLength: 6,
              inputMode: "numeric",
              pattern: "[0-9]*",
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                color="primary"
              />
            }
            label="Remember this device (skip 2FA for this account)"
            sx={{ mb: 2 }}
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
            }}
          >
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </form>
      </Box>
    </Box>
  );
}

export default function TwoFAPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TwoFAContent />
    </Suspense>
  );
}

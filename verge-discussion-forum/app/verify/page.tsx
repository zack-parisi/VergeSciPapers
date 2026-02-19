"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    if (!token || hasAttempted) return;
    setStatus("verifying");
    setError(null);
    setHasAttempted(true);
    fetch("/api/auth/mongodb/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) {
          setStatus("error");
          setError(data.error || "Verification failed");
        } else {
          setStatus("success");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Network error");
      });
  }, [token]);

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
          Email Verification
        </Typography>
        {status === "idle" && (
          <Typography sx={{ textAlign: "center" }}>
            No token provided.
          </Typography>
        )}
        {status === "verifying" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <CircularProgress color="primary" size={40} />
            <Typography sx={{ textAlign: "center", mt: 2 }}>
              Verifying...
            </Typography>
          </Box>
        )}
        {status === "success" && (
          <Box sx={{ textAlign: "center", color: "green" }}>
            <Typography sx={{ fontWeight: 700, mb: 2 }}>
              Email verified successfully!
            </Typography>
            <Button
              href="/login"
              variant="contained"
              color="primary"
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Go to login
            </Button>
          </Box>
        )}
        {status === "error" && (
          <Box sx={{ textAlign: "center", color: "#d32f2f" }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>
              Verification failed.
            </Typography>
            <Typography sx={{ fontSize: 15 }}>{error}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}

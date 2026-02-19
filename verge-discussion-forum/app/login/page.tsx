"use client";
import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { useSession } from "next-auth/react";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

function LoginContent() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/profile";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setError(
        res.error === "CredentialsSignin"
          ? "Invalid email or password"
          : res.error
      );
    } else if (res?.ok) {
      // Force a hard reload to ensure session is picked up
      window.location.replace(res.url || callbackUrl);
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
        pt: { xs: 6, sm: 10, md: 12 }, // move content down ~1 inch
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
          Log In
        </Typography>
        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
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
            autoComplete="current-password"
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
            {loading ? "Logging in..." : "Log In"}
          </Button>
        </form>
        <Box sx={{ mt: 3, width: "100%" }}>
          <Button
            href="/signup"
            variant="outlined"
            color="primary"
            fullWidth
            sx={{
              fontWeight: 700,
              fontSize: 16,
              borderRadius: 2,
              py: 1.2,
              mb: 2,
            }}
          >
            Don&apos;t have an account? Sign up
          </Button>
          <Button
            href="/forgot-password"
            variant="text"
            color="primary"
            fullWidth
            sx={{ fontWeight: 600, fontSize: 14, mb: 1 }}
          >
            Forgot your password?
          </Button>
          <Button
            href="/resend-verification"
            variant="text"
            color="primary"
            fullWidth
            sx={{ fontWeight: 600, fontSize: 14 }}
          >
            Didn&apos;t receive verification email?
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}

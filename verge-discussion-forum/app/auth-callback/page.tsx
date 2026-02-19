"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [authCode, setAuthCode] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setError(`OAuth Error: ${error}`);
    } else if (code) {
      setAuthCode(code);
    } else {
      setError("No authorization code found in URL");
    }
  }, [searchParams]);

  const handleCopy = () => {
    navigator.clipboard.writeText(authCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <Box sx={{ p: 4, maxWidth: 600, mx: "auto", mt: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography variant="body1">
          Please try the OAuth flow again or check your Google Cloud Console
          settings.
        </Typography>
      </Box>
    );
  }

  if (!authCode) {
    return (
      <Box sx={{ p: 4, maxWidth: 600, mx: "auto", mt: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Authorization Code Capture
        </Typography>
        <Typography variant="body1">
          Waiting for authorization code...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: "auto", mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3, color: "success.main" }}>
           Authorization Code Captured!
        </Typography>

        <Typography variant="body1" sx={{ mb: 2 }}>
          Your authorization code has been successfully captured. Copy this code
          and paste it into your terminal:
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={4}
          value={authCode}
          variant="outlined"
          sx={{ mb: 2 }}
          InputProps={{
            readOnly: true,
            style: { fontFamily: "monospace", fontSize: "14px" },
          }}
        />

        <Button variant="contained" onClick={handleCopy} sx={{ mr: 2 }}>
          {copied ? "Copied!" : "Copy Code"}
        </Button>

        <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
          After copying the code, go back to your terminal and paste it when
          prompted.
        </Typography>
      </Paper>
    </Box>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{ p: 4, maxWidth: 600, mx: "auto", mt: 4, textAlign: "center" }}
        >
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body1">Loading authorization code...</Typography>
        </Box>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}

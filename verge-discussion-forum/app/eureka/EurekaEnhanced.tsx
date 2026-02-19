"use client";
import { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import ArticleIcon from "@mui/icons-material/Article";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import BubbleChartIcon from "@mui/icons-material/BubbleChart";
import Chip from "@mui/material/Chip";
import EurekaPaperStaffCard from "./EurekaPaperStaffCard";
import EurekaResponseFormatter from "./EurekaResponseFormatter";
import EurekaTranslateFormatter from "./EurekaTranslateFormatter";
import EurekaUpdateFormatter from "./EurekaUpdateFormatter";
import EurekaChatFormatter from "./EurekaChatFormatter";
import EurekaResultCard from "./EurekaResultCard";
import { getRandomQuestions } from "./exampleQuestions";

// Neural network background animation component
const NeuralBackground = () => (
  <Box
    sx={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: "hidden",
      background:
        "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)",
      pointerEvents: "none",
      zIndex: 0,
    }}
  >
    {[...Array(12)].map((_, i) => (
      <Box
        key={i}
        sx={{
          position: "absolute",
          width: `${Math.random() * 200 + 100}px`,
          height: `${Math.random() * 200 + 100}px`,
          borderRadius: "50%",
          border: "1px solid rgba(25, 118, 210, 0.1)",
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          animation: `neuralPulse ${Math.random() * 8 + 6}s ease-in-out infinite`,
          animationDelay: `${Math.random() * 3}s`,
          "@keyframes neuralPulse": {
            "0%, 100%": {
              transform: "scale(1) translateY(0)",
              opacity: 0.1,
            },
            "50%": {
              transform: `scale(${1 + Math.random() * 0.3}) translateY(-20px)`,
              opacity: 0.3,
            },
          },
        }}
      />
    ))}
    {/* Synaptic connections */}
    {[...Array(8)].map((_, i) => (
      <Box
        key={`line-${i}`}
        sx={{
          position: "absolute",
          width: "1px",
          height: `${Math.random() * 300 + 200}px`,
          background:
            "linear-gradient(180deg, transparent, rgba(25, 118, 210, 0.3), transparent)",
          top: `${Math.random() * 80}%`,
          left: `${Math.random() * 100}%`,
          transform: `rotate(${Math.random() * 360}deg)`,
          animation: `synapticFlow ${Math.random() * 10 + 8}s linear infinite`,
          animationDelay: `${Math.random() * 5}s`,
          "@keyframes synapticFlow": {
            "0%": { opacity: 0 },
            "50%": { opacity: 0.2 },
            "100%": { opacity: 0 },
          },
        }}
      />
    ))}
  </Box>
);

// Floating particles
const FloatingParticles = () => (
  <Box
    sx={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: 1,
    }}
  >
    {[...Array(20)].map((_, i) => (
      <Box
        key={i}
        sx={{
          position: "absolute",
          width: `${Math.random() * 4 + 2}px`,
          height: `${Math.random() * 4 + 2}px`,
          borderRadius: "50%",
          backgroundColor: "#1976d2",
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          opacity: 0,
          animation: `particleDrift ${Math.random() * 15 + 10}s linear infinite`,
          animationDelay: `${Math.random() * 5}s`,
          "@keyframes particleDrift": {
            "0%": {
              transform: "translateY(0) translateX(0)",
              opacity: 0,
            },
            "10%": {
              opacity: 0.4,
            },
            "90%": {
              opacity: 0.1,
            },
            "100%": {
              transform: `translateY(-100vh) translateX(${Math.random() * 100 - 50}px)`,
              opacity: 0,
            },
          },
        }}
      />
    ))}
  </Box>
);

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  papers?: any[];
  metadata?: any;
  id?: string; // Stable ID for Eureka responses
}

type SearchMode = "quick" | "update" | "investigate" | "translate";

export default function EurekaEnhanced() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // MODES HIDDEN - Can be restored easily if needed
  // const [searchMode, setSearchMode] = useState<SearchMode>("quick"); // Default to Quick Search
  const [expandedPapers, setExpandedPapers] = useState<{
    [key: number]: boolean;
  }>({});
  const [loadingProgress, setLoadingProgress] = useState<string>(
    "Initializing search..."
  );
  const [paperSearchState, setPaperSearchState] = useState<{
    [key: number]: { loading?: boolean; error?: string; fetched?: boolean };
  }>({});
  const [currentQuestions, setCurrentQuestions] = useState<string[]>([]);
  const [fadeIn, setFadeIn] = useState(true);
  const [isMounted, setIsMounted] = useState(false); // For client-side only animations
  const [isInIframe, setIsInIframe] = useState(false); // Detect if in popup/iframe
  const latestResponseRef = useRef<HTMLDivElement>(null);

  const scrollToTopOfLatestResponse = () => {
    latestResponseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Load messages from sessionStorage on mount (cleared when window closes)
  useEffect(() => {
    const savedMessages = sessionStorage.getItem('eureka-messages');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        const messagesWithDates = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
      } catch (e) {
        console.error('Failed to load saved messages', e);
      }
    }
  }, []);

  // Save messages to sessionStorage whenever they change (cleared when window closes)
  // Also set flag to indicate user is actively using Eureka chat
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('eureka-messages', JSON.stringify(messages));
      // Set flag to auto-open popup when navigating to other pages
      sessionStorage.setItem('eurekaChatActive', 'true');
    }
  }, [messages]);

  // Scroll to top of latest response when a new assistant message is added
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === "assistant") {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        scrollToTopOfLatestResponse();
      }, 100);
    }
  }, [messages]);

  // Set mounted state on client side only
  useEffect(() => {
    setIsMounted(true);
    // Detect if we're in an iframe (popup context)
    setIsInIframe(window.self !== window.top);
  }, []);

  // Initialize and rotate example questions
  useEffect(() => {
    // Set initial questions
    setCurrentQuestions(getRandomQuestions(3));

    // Rotate questions every 20 seconds
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentQuestions(getRandomQuestions(3));
        setFadeIn(true);
      }, 300); // Fade out duration
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: query.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setLoading(true);
    setError(null);

    try {
      // Fast Chat Mode: Super-fast, efficient neuroscience chatbot
      setLoadingProgress("Analyzing query...");
      setTimeout(() => setLoadingProgress("Searching database..."), 2000);
      setTimeout(() => setLoadingProgress("Retrieving context..."), 5000);
      setTimeout(() => setLoadingProgress("Generating response..."), 10000);

      const response = await fetch("/api/eureka/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userMessage.content,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from Eureka");
      }

      const data = await response.json();

      // Generate a stable ID for this Eureka response
      const eurekaId = `eureka:${Date.now()}-${messages.length}-${userMessage.content.substring(0, 20).replace(/\s/g, "-")}`;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
        timestamp: new Date(),
        papers: data.papers || [],
        metadata: { ...data.metadata, mode: "chat" },
        id: eurekaId,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      /* MODES HIDDEN - Can be restored easily if needed
      if (searchMode === "quick") {
        // Quick Search Mode: Fast top-10 paper discovery
        setLoadingProgress("Quick search in progress...");
        setTimeout(() => setLoadingProgress("Analyzing query..."), 2000);
        setTimeout(() => setLoadingProgress("Searching database..."), 5000);
        setTimeout(() => setLoadingProgress("Retrieving papers..."), 10000);
        setTimeout(() => setLoadingProgress("Ranking results..."), 30000);
        setTimeout(() => setLoadingProgress("Finalizing top 10..."), 60000);

        const response = await fetch("/api/eureka/quick-search-full", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: userMessage.content,
            limit: 10,
            numCandidates: 30,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response from Eureka Quick Search");
        }

        const data = await response.json();

        const assistantMessage: Message = {
          role: "assistant",
          content: "", // Quick search doesn't have narrative content
          timestamp: new Date(),
          papers: data.results || [],
          metadata: { ...data.metadata, mode: "quick", notes: data.notes },
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else if (searchMode === "update") {
        // Update Me Mode: Recent papers from last 12 months
        setLoadingProgress("Searching recent papers...");
        setTimeout(
          () => setLoadingProgress("Filtering last 12 months..."),
          2000
        );
        setTimeout(
          () => setLoadingProgress("Analyzing latest findings..."),
          5000
        );
        setTimeout(() => setLoadingProgress("Retrieving updates..."), 10000);
        setTimeout(() => setLoadingProgress("Generating digest..."), 30000);
        setTimeout(() => setLoadingProgress("Finalizing update..."), 60000);

        const response = await fetch("/api/eureka/update-me-full", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: userMessage.content,
            limit: 12,
            numCandidates: 40,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response from Eureka Update Me");
        }

        const data = await response.json();

        const assistantMessage: Message = {
          role: "assistant",
          content: data.digest,
          timestamp: new Date(),
          papers: data.papers || [],
          metadata: {
            ...data.metadata,
            mode: "update",
            clarifications: data.clarifications,
          },
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else if (searchMode === "investigate") {
        // Investigate Mode: Deep analysis with narrative
        setLoadingProgress("Preprocessing query...");
        setTimeout(() => setLoadingProgress("Generating embeddings..."), 2000);
        setTimeout(
          () => setLoadingProgress("Searching vector database..."),
          5000
        );
        setTimeout(() => setLoadingProgress("Retrieving papers..."), 10000);
        setTimeout(
          () => setLoadingProgress("Generating Nobel-level answer..."),
          15000
        );
        setTimeout(() => setLoadingProgress("Finalizing response..."), 40000);

        const response = await fetch("/api/eureka/search-full", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: userMessage.content,
            limit: 3,
            numCandidates: 50,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response from Eureka");
        }

        const data = await response.json();

        const assistantMessage: Message = {
          role: "assistant",
          content: data.answer,
          timestamp: new Date(),
          papers: data.papers || [],
          metadata: { ...data.metadata, mode: "investigate" },
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else if (searchMode === "translate") {
        // Translate Mode: Cross-subfield terminology bridges
        setLoadingProgress("Analyzing subfield translation...");
        setTimeout(
          () => setLoadingProgress("Building terminology bridges..."),
          2000
        );
        setTimeout(
          () => setLoadingProgress("Searching for crosswalks..."),
          5000
        );
        setTimeout(
          () => setLoadingProgress("Retrieving bridge papers..."),
          10000
        );
        setTimeout(
          () => setLoadingProgress("Generating translation..."),
          30000
        );
        setTimeout(() => setLoadingProgress("Finalizing response..."), 60000);

        const response = await fetch("/api/eureka/translate-full", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: userMessage.content,
            limit: 12,
            numCandidates: 30,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response from Eureka Translate");
        }

        const data = await response.json();

        const assistantMessage: Message = {
          role: "assistant",
          content: data.translation,
          timestamp: new Date(),
          papers: data.papers || [],
          metadata: {
            ...data.metadata,
            mode: "translate",
            clarifications: data.clarifications,
          },
        };

        setMessages((prev) => [...prev, assistantMessage]);
      }
      */
    } catch (err: any) {
      console.error("Eureka error:", err);
      setError(err.message || "Failed to process your query");
    } finally {
      setLoading(false);
    }
  };

  const handleFindPapers = async (messageIndex: number, question?: string) => {
    if (!question) {
      setPaperSearchState((prev) => ({
        ...prev,
        [messageIndex]: {
          loading: false,
          error: "Original question unavailable for semantic search.",
        },
      }));
      return;
    }

    setPaperSearchState((prev) => ({
      ...prev,
      [messageIndex]: {
        ...prev[messageIndex],
        loading: true,
        error: undefined,
      },
    }));

    try {
      const response = await fetch("/api/eureka/quick-search-full", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: question,
          limit: 5,
          numCandidates: 25,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error ||
            "Failed to fetch related papers. Please try again."
        );
      }

      const data = await response.json();
      const papers = data?.results || [];

      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === messageIndex ? { ...msg, papers } : msg
        )
      );

      // Don't auto-expand papers - keep them collapsed by default
      // setExpandedPapers((prev) => ({
      //   ...prev,
      //   [messageIndex]: true,
      // }));

      setPaperSearchState((prev) => ({
        ...prev,
        [messageIndex]: { loading: false, fetched: true, error: undefined },
      }));
    } catch (err: any) {
      setPaperSearchState((prev) => ({
        ...prev,
        [messageIndex]: {
          loading: false,
          error:
            err?.message || "Failed to fetch related papers. Please try again.",
        },
      }));
    }
  };

  const togglePapers = (messageIndex: number) => {
    setExpandedPapers((prev) => ({
      ...prev,
      [messageIndex]: !prev[messageIndex],
    }));
  };

  return (
    <Box
      sx={{
        background: "transparent",
        color: "#1a1a1a",
        borderRadius: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated Neural Background - Full viewport (client-side only to avoid hydration errors) */}
      {isMounted && (
        <>
          <NeuralBackground />
          <FloatingParticles />
        </>
      )}

      {/* Messages Area - Now includes header at top, extends to bottom */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          px: 3,
          pt: 3,
          paddingBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minHeight: 0,
          position: "relative",
          zIndex: 5,
          "::-webkit-scrollbar": {
            width: "6px",
          },
          "::-webkit-scrollbar-thumb": {
            background: "rgba(25, 118, 210, 0.2)",
            borderRadius: "10px",
          },
          "::-webkit-scrollbar-track": {
            background: "transparent",
          },
        }}
      >
        {/* Eureka Header - Only show when messages exist */}
        {(messages.length > 0 || loading) && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              pb: 4,
              mb: 2,
              position: "relative",
              zIndex: 10,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                mb: 1.5,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                  boxShadow: "0 4px 20px rgba(25, 118, 210, 0.25)",
                  animation: "logoGlow 3s ease-in-out infinite",
                  "@keyframes logoGlow": {
                    "0%, 100%": {
                      boxShadow: "0 4px 20px rgba(25, 118, 210, 0.25)",
                    },
                    "50%": {
                      boxShadow: "0 6px 30px rgba(25, 118, 210, 0.4)",
                    },
                  },
                }}
              >
                <BubbleChartIcon sx={{ fontSize: 28, color: "white" }} />
              </Box>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 300,
                  fontSize: "2.5rem",
                  letterSpacing: "-0.02em",
                  background:
                    "linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Eureka
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{
                color: "#666",
                textAlign: "center",
                fontSize: "0.95rem",
                fontWeight: 400,
                letterSpacing: "0.01em",
                lineHeight: 1.6,
              }}
            >
              Let&apos;s conVergeScience!
            </Typography>
          </Box>
        )}

        {messages.length === 0 && !loading && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              gap: 3,
            }}
          >
            {/* Eureka Logo and Title - Only in empty state */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                mb: 1,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                  boxShadow: "0 4px 20px rgba(25, 118, 210, 0.25)",
                  animation: "logoGlow 3s ease-in-out infinite",
                  "@keyframes logoGlow": {
                    "0%, 100%": {
                      boxShadow: "0 4px 20px rgba(25, 118, 210, 0.25)",
                    },
                    "50%": {
                      boxShadow: "0 6px 30px rgba(25, 118, 210, 0.4)",
                    },
                  },
                }}
              >
                <BubbleChartIcon sx={{ fontSize: 32, color: "white" }} />
              </Box>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 300,
                  fontSize: "2.75rem",
                  letterSpacing: "-0.02em",
                  background:
                    "linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Eureka
              </Typography>
            </Box>

            <Typography
              variant="h5"
              sx={{
                fontWeight: 300,
                letterSpacing: "-0.01em",
                color: "#2c3e50",
                textAlign: "center",
                maxWidth: 600,
              }}
            >
              Field-wide Insights in Seconds
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "#7f8c8d",
                maxWidth: 600,
                textAlign: "center",
                fontSize: "1rem",
                lineHeight: 1.7,
              }}
            >
              Ask neuroscience-related questions. Receive research-backed
              responses.
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1.5,
                justifyContent: "center",
                mt: 2,
                opacity: fadeIn ? 1 : 0,
                transition: "opacity 0.3s ease-in-out",
              }}
            >
              {currentQuestions.map((suggestion, i) => (
                <Box
                  key={`${suggestion}-${i}`}
                  onClick={() => setQuery(suggestion)}
                  sx={{
                    px: 2.5,
                    py: 1,
                    borderRadius: "20px",
                    border: "1px solid rgba(25, 118, 210, 0.15)",
                    background: "rgba(255, 255, 255, 0.8)",
                    color: "#1976d2",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      background: "rgba(25, 118, 210, 0.05)",
                      borderColor: "rgba(25, 118, 210, 0.3)",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  {suggestion}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {messages.map((message, index) => (
          <Box key={index}>
            {/* User Message */}
            {message.role === "user" && (
              <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    maxWidth: "75%",
                    background:
                      "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                    color: "white",
                    borderRadius: "20px 20px 4px 20px",
                    boxShadow: "0 4px 20px rgba(25, 118, 210, 0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      fontSize: "1rem",
                      lineHeight: 1.6,
                      fontWeight: 400,
                    }}
                  >
                    {message.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      opacity: 0.7,
                      display: "block",
                      mt: 1,
                      fontSize: "0.75rem",
                    }}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </Typography>
                </Paper>
              </Box>
            )}

            {/* Assistant Message with Papers */}
            {message.role === "assistant" && (
              <Box
                ref={index === messages.length - 1 ? latestResponseRef : null}
                sx={{ scrollMarginTop: 20 }}
              >
                <EurekaResultCard
                  message={message}
                  query={messages[index - 1]?.content || ""}
                  index={index}
                  onFindPapers={() =>
                    handleFindPapers(index, messages[index - 1]?.content)
                  }
                  findPapersState={paperSearchState[index]}
                >
                <Box sx={{ mb: 1 }}>
                  {message.metadata?.mode === "chat" ? (
                    /* Chat Mode: Simple, fast responses */
                    <Paper
                      elevation={0}
                      sx={{
                        p: 4,
                        background: "rgba(255, 255, 255, 0.95)",
                        borderRadius: "20px 20px 20px 4px",
                        border: "1px solid rgba(25, 118, 210, 0.08)",
                        backdropFilter: "blur(10px)",
                        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
                        maxWidth: isInIframe ? "100%" : "none",
                        width: "100%",
                        boxSizing: "border-box",
                        overflow: "hidden",
                      }}
                    >
                      <Box sx={{ mb: 2 }}>
                        <EurekaChatFormatter content={message.content} />
                      </Box>

                      {paperSearchState[index]?.loading && (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            mb: 2,
                            p: 2,
                            borderRadius: 2,
                            background: "rgba(25, 118, 210, 0.05)",
                            border: "1px dashed rgba(25, 118, 210, 0.3)",
                          }}
                        >
                          <CircularProgress
                            size={18}
                            sx={{ color: "#1976d2" }}
                          />
                          <Typography
                            variant="body2"
                            sx={{ color: "#1976d2", fontWeight: 500 }}
                          >
                            Fetching 5 VergeSci papers...
                          </Typography>
                        </Box>
                      )}

                      {paperSearchState[index]?.error && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                          {paperSearchState[index]?.error}
                        </Alert>
                      )}

                      {message.papers && message.papers.length > 0 && (
                        <>
                          <Divider sx={{ my: 2 }} />
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              cursor: "pointer",
                            }}
                            onClick={() => togglePapers(index)}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <ArticleIcon
                                sx={{ fontSize: 20, color: "#1976d2" }}
                              />
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 600 }}
                              >
                                {message.papers.length} Source Papers
                              </Typography>
                            </Box>
                            <IconButton size="small">
                              {expandedPapers[index] ? (
                                <ExpandLessIcon />
                              ) : (
                                <ExpandMoreIcon />
                              )}
                            </IconButton>
                          </Box>

                          <Collapse in={expandedPapers[index]}>
                            <Box
                              sx={{
                                mt: 3,
                                display: "flex",
                                flexDirection: "column",
                                gap: 2.5,
                                width: "100%",
                                maxWidth: isInIframe ? "100%" : "none",
                                overflow: "hidden",
                              }}
                            >
                              {message.papers.map((paper, paperIndex) => (
                                <EurekaPaperStaffCard
                                  key={paperIndex}
                                  paper={paper}
                                  index={paperIndex}
                                />
                              ))}
                            </Box>
                          </Collapse>
                        </>
                      )}

                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.7, display: "block", mt: 2 }}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Paper>
                  ) : message.metadata?.mode === "quick" ? (
                    /* Quick Search Mode: Display papers directly without dropdown */
                    <Box>
                      {/* Brief notes if available */}
                      {message.metadata?.notes &&
                        message.metadata.notes.length > 0 && (
                          <Paper
                            elevation={0}
                            sx={{
                              p: 3,
                              mb: 3,
                              background: "rgba(255, 255, 255, 0.95)",
                              borderRadius: "20px 20px 20px 4px",
                              border: "1px solid rgba(25, 118, 210, 0.08)",
                              backdropFilter: "blur(10px)",
                              boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
                              maxWidth: isInIframe ? "100%" : "none",
                              width: "100%",
                              boxSizing: "border-box",
                              overflow: "hidden",
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                mb: 2,
                              }}
                            >
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 600, color: "#1976d2" }}
                              >
                                 Quick Search Results
                              </Typography>
                            </Box>
                            {message.metadata.notes.map(
                              (note: string, noteIndex: number) => (
                                <Typography
                                  key={noteIndex}
                                  variant="body2"
                                  sx={{
                                    color: "#7f8c8d",
                                    fontSize: "0.9rem",
                                    mb: 0.5,
                                  }}
                                >
                                  • {note}
                                </Typography>
                              )
                            )}
                          </Paper>
                        )}

                      {/* Display papers directly */}
                      {message.papers && message.papers.length > 0 && (
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2.5,
                            width: "100%",
                            maxWidth: isInIframe ? "100%" : "none",
                            overflow: "hidden",
                          }}
                        >
                          {message.papers.map((paper, paperIndex) => (
                            <EurekaPaperStaffCard
                              key={paperIndex}
                              paper={paper}
                              index={paperIndex}
                            />
                          ))}
                        </Box>
                      )}

                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.7, display: "block", mt: 2, ml: 1 }}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Box>
                  ) : message.metadata?.mode === "update" ? (
                    /* Update Me Mode: Headline summary + staff post cards directly */
                    <Box>
                      {/* Headline summary box */}
                      <Paper
                        elevation={0}
                        sx={{
                          p: 4,
                          mb: 3,
                          background: "rgba(255, 255, 255, 0.95)",
                          borderRadius: "20px 20px 20px 4px",
                          border: "1px solid rgba(25, 118, 210, 0.08)",
                          backdropFilter: "blur(10px)",
                          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
                          maxWidth: isInIframe ? "100%" : "none",
                          width: "100%",
                          boxSizing: "border-box",
                          overflow: "hidden",
                        }}
                      >
                        {/* Time range badge */}
                        <Chip
                          icon={
                            <Typography sx={{ fontSize: "1rem" }}>
                              
                            </Typography>
                          }
                          label="Last 12 Months"
                          size="small"
                          sx={{
                            mb: 2,
                            bgcolor: "rgba(25, 118, 210, 0.1)",
                            color: "#1976d2",
                            fontWeight: 600,
                            border: "1px solid rgba(25, 118, 210, 0.2)",
                          }}
                        />

                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 700,
                            fontSize: "1.2rem",
                            color: "#1976d2",
                            mb: 2,
                          }}
                        >
                          Recent Developments
                        </Typography>

                        <Typography
                          variant="body1"
                          sx={{
                            color: "#2c3e50",
                            fontSize: "1rem",
                            lineHeight: 1.8,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {message.content}
                        </Typography>

                        {/* Display clarifications if any */}
                        {message.metadata?.clarifications &&
                          message.metadata.clarifications.length > 0 && (
                            <Box
                              sx={{
                                mt: 3,
                                p: 2,
                                bgcolor: "rgba(255, 193, 7, 0.1)",
                                borderRadius: 2,
                              }}
                            >
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  fontWeight: 600,
                                  color: "#f57c00",
                                  mb: 1,
                                }}
                              >
                                 Clarifications Needed:
                              </Typography>
                              {message.metadata.clarifications.map(
                                (clarif: string, idx: number) => (
                                  <Typography
                                    key={idx}
                                    variant="body2"
                                    sx={{ color: "#666", fontSize: "0.9rem" }}
                                  >
                                    • {clarif}
                                  </Typography>
                                )
                              )}
                            </Box>
                          )}

                        <Typography
                          variant="caption"
                          sx={{ opacity: 0.7, display: "block", mt: 2 }}
                        >
                          {message.timestamp.toLocaleTimeString()}
                        </Typography>
                      </Paper>

                      {/* Display papers directly as staff cards */}
                      {message.papers && message.papers.length > 0 && (
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2.5,
                            width: "100%",
                            maxWidth: isInIframe ? "100%" : "none",
                            overflow: "hidden",
                          }}
                        >
                          {message.papers.map((paper, paperIndex) => (
                            <EurekaPaperStaffCard
                              key={paperIndex}
                              paper={paper}
                              index={paperIndex}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  ) : message.metadata?.mode === "translate" ? (
                    /* Translate Mode: Display translation with papers in dropdown */
                    <Paper
                      elevation={0}
                      sx={{
                        p: 4,
                        background: "rgba(255, 255, 255, 0.95)",
                        borderRadius: "20px 20px 20px 4px",
                        border: "1px solid rgba(25, 118, 210, 0.08)",
                        backdropFilter: "blur(10px)",
                        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
                        maxWidth: isInIframe ? "100%" : "none",
                        width: "100%",
                        boxSizing: "border-box",
                        overflow: "hidden",
                      }}
                    >
                      <Box sx={{ mb: 3 }}>
                        <EurekaTranslateFormatter content={message.content} />
                      </Box>

                      {/* Display clarifications if any */}
                      {message.metadata?.clarifications &&
                        message.metadata.clarifications.length > 0 && (
                          <Box
                            sx={{
                              mb: 3,
                              p: 2,
                              bgcolor: "rgba(255, 193, 7, 0.1)",
                              borderRadius: 2,
                            }}
                          >
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: 600, color: "#f57c00", mb: 1 }}
                            >
                               Clarifications Needed:
                            </Typography>
                            {message.metadata.clarifications.map(
                              (clarif: string, idx: number) => (
                                <Typography
                                  key={idx}
                                  variant="body2"
                                  sx={{ color: "#666", fontSize: "0.9rem" }}
                                >
                                  • {clarif}
                                </Typography>
                              )
                            )}
                          </Box>
                        )}

                      {message.papers && message.papers.length > 0 && (
                        <>
                          <Divider sx={{ my: 2 }} />
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              cursor: "pointer",
                            }}
                            onClick={() => togglePapers(index)}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <ArticleIcon
                                sx={{ fontSize: 20, color: "#1976d2" }}
                              />
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 600 }}
                              >
                                {message.papers.length} Bridge Papers
                              </Typography>
                            </Box>
                            <IconButton size="small">
                              {expandedPapers[index] ? (
                                <ExpandLessIcon />
                              ) : (
                                <ExpandMoreIcon />
                              )}
                            </IconButton>
                          </Box>

                          <Collapse in={expandedPapers[index]}>
                            <Box
                              sx={{
                                mt: 3,
                                display: "flex",
                                flexDirection: "column",
                                gap: 2.5,
                                width: "100%",
                                maxWidth: isInIframe ? "100%" : "none",
                                overflow: "hidden",
                              }}
                            >
                              {message.papers.map((paper, paperIndex) => (
                                <EurekaPaperStaffCard
                                  key={paperIndex}
                                  paper={paper}
                                  index={paperIndex}
                                />
                              ))}
                            </Box>
                          </Collapse>
                        </>
                      )}

                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.7, display: "block", mt: 2 }}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Paper>
                ) : (
                  /* Investigate Mode: Display narrative with papers in dropdown */
                  <Paper
                    elevation={0}
                    sx={{
                      p: 4,
                      background: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "20px 20px 20px 4px",
                      border: "1px solid rgba(25, 118, 210, 0.08)",
                      backdropFilter: "blur(10px)",
                      boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
                      maxWidth: isInIframe ? "100%" : "none",
                      width: "100%",
                      boxSizing: "border-box",
                      overflow: "hidden",
                    }}
                  >
                      <Box sx={{ mb: 3 }}>
                        <EurekaResponseFormatter content={message.content} />
                      </Box>

                      {message.papers && message.papers.length > 0 && (
                        <>
                          <Divider sx={{ my: 2 }} />
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              cursor: "pointer",
                            }}
                            onClick={() => togglePapers(index)}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <ArticleIcon
                                sx={{ fontSize: 20, color: "#1976d2" }}
                              />
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 600 }}
                              >
                                {message.papers.length} Source Papers
                              </Typography>
                            </Box>
                            <IconButton size="small">
                              {expandedPapers[index] ? (
                                <ExpandLessIcon />
                              ) : (
                                <ExpandMoreIcon />
                              )}
                            </IconButton>
                          </Box>

                          <Collapse in={expandedPapers[index]}>
                            <Box
                              sx={{
                                mt: 3,
                                display: "flex",
                                flexDirection: "column",
                                gap: 2.5,
                                width: "100%",
                                maxWidth: isInIframe ? "100%" : "none",
                                overflow: "hidden",
                              }}
                            >
                              {message.papers.map((paper, paperIndex) => (
                                <EurekaPaperStaffCard
                                  key={paperIndex}
                                  paper={paper}
                                  index={paperIndex}
                                />
                              ))}
                            </Box>
                          </Collapse>
                        </>
                      )}

                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.7, display: "block", mt: 2 }}
                      >
                        {message.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Paper>
                  )}
                </Box>
              </EurekaResultCard>
              </Box>
            )}
          </Box>
        ))}

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
            <Paper
              elevation={0}
              sx={{
                p: 4,
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: "20px 20px 20px 4px",
                border: "1px solid rgba(25, 118, 210, 0.12)",
                backdropFilter: "blur(10px)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                minWidth: 320,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
                <CircularProgress
                  size={24}
                  thickness={3}
                  sx={{ color: "#1976d2" }}
                />
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 400,
                    color: "#2c3e50",
                    fontSize: "1.05rem",
                  }}
                >
                  Eureka is analyzing...
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  color: "#7f8c8d",
                  ml: 5,
                  fontSize: "0.9rem",
                  fontWeight: 400,
                }}
              >
                {loadingProgress}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "#95a5a6",
                  ml: 5,
                  fontStyle: "italic",
                  fontSize: "0.8rem",
                }}
              >
                Fast chat response typically takes 10-30 seconds
              </Typography>
            </Paper>
          </Box>
        )}

        {error && (
          <Paper
            elevation={0}
            sx={{ p: 2, bgcolor: "#ffebee", borderRadius: 2 }}
          >
            <Typography variant="body2" sx={{ color: "#c62828" }}>
              Error: {error}
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Input Area - Completely transparent, floats over grey background */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          p: 2,
          pt: 1,
          pb: 1,
          background:
            "linear-gradient(to top, rgba(255,255,255,0.98) 60%, transparent)",
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }}
      >
        {/* MODES HIDDEN - Can be restored easily if needed */}
        {/* Mode Toggle - Above the search bar */}
        {/* <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
          <Box
            sx={{
              display: "inline-flex",
              gap: 0.5,
              padding: "3px",
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: "16px",
              border: "1px solid rgba(25, 118, 210, 0.12)",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            }}
          >
            <Box
              onClick={() => setSearchMode("quick")}
              sx={{
                px: 2,
                py: 0.5,
                borderRadius: "14px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                background:
                  searchMode === "quick"
                    ? "linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)"
                    : "transparent",
                color: searchMode === "quick" ? "white" : "#7f8c8d",
                fontSize: "0.75rem",
                fontWeight: searchMode === "quick" ? 600 : 500,
                "&:hover": {
                  background:
                    searchMode === "quick"
                      ? "linear-gradient(135deg, #1565c0 0%, #1976d2 100%)"
                      : "rgba(25, 118, 210, 0.08)",
                },
              }}
            >
               Scan
            </Box>
            <Box
              onClick={() => setSearchMode("update")}
              sx={{
                px: 2,
                py: 0.5,
                borderRadius: "14px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                background:
                  searchMode === "update"
                    ? "linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)"
                    : "transparent",
                color: searchMode === "update" ? "white" : "#7f8c8d",
                fontSize: "0.75rem",
                fontWeight: searchMode === "update" ? 600 : 500,
                "&:hover": {
                  background:
                    searchMode === "update"
                      ? "linear-gradient(135deg, #1565c0 0%, #1976d2 100%)"
                      : "rgba(25, 118, 210, 0.08)",
                },
              }}
            >
               Update
            </Box>
            <Box
              onClick={() => setSearchMode("investigate")}
              sx={{
                px: 2,
                py: 0.5,
                borderRadius: "14px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                background:
                  searchMode === "investigate"
                    ? "linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)"
                    : "transparent",
                color: searchMode === "investigate" ? "white" : "#7f8c8d",
                fontSize: "0.75rem",
                fontWeight: searchMode === "investigate" ? 600 : 500,
                "&:hover": {
                  background:
                    searchMode === "investigate"
                      ? "linear-gradient(135deg, #1565c0 0%, #1976d2 100%)"
                      : "rgba(25, 118, 210, 0.08)",
                },
              }}
            >
               Investigate
            </Box>
            <Box
              onClick={() => setSearchMode("translate")}
              sx={{
                px: 2,
                py: 0.5,
                borderRadius: "14px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                background:
                  searchMode === "translate"
                    ? "linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)"
                    : "transparent",
                color: searchMode === "translate" ? "white" : "#7f8c8d",
                fontSize: "0.75rem",
                fontWeight: searchMode === "translate" ? 600 : 500,
                "&:hover": {
                  background:
                    searchMode === "translate"
                      ? "linear-gradient(135deg, #1565c0 0%, #1976d2 100%)"
                      : "rgba(25, 118, 210, 0.08)",
                },
              }}
            >
               Translate
            </Box>
          </Box>
        </Box>
        */}

        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-end" }}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about neuroscience..."
            variant="outlined"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "20px",
                background: "rgba(255, 255, 255, 0.9)",
                border: "1.5px solid rgba(25, 118, 210, 0.12)",
                transition: "all 0.3s ease",
                fontSize: "0.875rem",
                "&:hover": {
                  border: "1.5px solid rgba(25, 118, 210, 0.25)",
                  background: "rgba(255, 255, 255, 1)",
                },
                "&.Mui-focused": {
                  border: "1.5px solid rgba(25, 118, 210, 0.4)",
                  background: "white",
                  boxShadow: "0 4px 16px rgba(25, 118, 210, 0.08)",
                },
              },
              "& .MuiOutlinedInput-notchedOutline": {
                border: "none",
              },
              "& input::placeholder": {
                color: "#95a5a6",
                opacity: 1,
              },
            }}
          />
          <Button
            type="submit"
            disabled={!query.trim() || loading}
            sx={{
              minWidth: 48,
              height: 48,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
              boxShadow: "0 4px 16px rgba(25, 118, 210, 0.25)",
              transition: "all 0.3s ease",
              "&:hover": {
                background: "linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)",
                boxShadow: "0 6px 20px rgba(25, 118, 210, 0.35)",
                transform: "translateY(-1px)",
              },
              "&:disabled": {
                background: "#e0e0e0",
                boxShadow: "none",
              },
            }}
          >
            {loading ? (
              <CircularProgress size={20} sx={{ color: "white" }} />
            ) : (
              <BubbleChartIcon sx={{ fontSize: 24, color: "white" }} />
            )}
          </Button>
        </Box>
        {/* Disclaimer under chat box */}
        <Box sx={{ mt: 1, display: "flex", justifyContent: "center" }}>
          <Typography
            variant="caption"
            sx={{
              color: "#6b7280",
              textAlign: "center",
              fontStyle: "italic",
              fontSize: 11,
            }}
          >
            Eureka is an experiment. While we strive for accuracy, the
            information provided may contain mistakes and should be used with
            caution.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

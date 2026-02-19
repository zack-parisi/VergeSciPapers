"use client";
import React, { useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
} from "@mui/material";
import OptimizedMongoDBPapersSection from "../components/OptimizedMongoDBPapersSection";
import { usePapersDataStore } from "../../lib/papers-data-store";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`papers-tabpanel-${index}`}
      aria-labelledby={`papers-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function MongoDBPapersPage() {
  const [tabValue, setTabValue] = React.useState(0);
  const { loading, error, fetchPapers, hasData } = usePapersDataStore();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Fetch data once on mount
  useEffect(() => {
    if (!hasData && !loading) {
      // Fetch a larger batch of papers that can be used across all tabs
      fetchPapers({ limit: 100, minRelevance: 0.7 });
    }
  }, [hasData, loading, fetchPapers]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" gutterBottom>
        Research Papers Database
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Explore the latest research papers from our MongoDB database with 3.7+
        million papers.
        <br />
        <strong>Optimized loading:</strong> Data is fetched once and shared
        across all tabs for instant switching.
      </Typography>

      {/* Initial Loading */}
      {loading && !hasData && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 8 }}>
          <Box sx={{ textAlign: "center" }}>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Loading papers...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This will only happen once per session
            </Typography>
          </Box>
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 8 }}>
          <Typography color="error" variant="h6">
            Error loading papers: {error}
          </Typography>
        </Box>
      )}

      {/* Content - Only show when data is available */}
      {hasData && (
        <Paper sx={{ width: "100%" }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="papers tabs"
            sx={{ borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="High Relevance Papers" />
            <Tab label="Recent Papers" />
            <Tab label="Highly Cited Papers" />
            <Tab label="Neuroscience Papers" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <OptimizedMongoDBPapersSection
              title="High Relevance Papers (0.8+) - Current"
              limit={10}
              minRelevance={0.8}
              algorithm="relevance"
              autoFetch={false}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <OptimizedMongoDBPapersSection
              title="Recent Papers (2024+) - Current"
              limit={10}
              minRelevance={0.7}
              algorithm="relevance"
              autoFetch={false}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <OptimizedMongoDBPapersSection
              title="Highly Cited Papers - Seminal"
              limit={10}
              minRelevance={0.7}
              algorithm="seminal"
              autoFetch={false}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <OptimizedMongoDBPapersSection
              title="Neuroscience Papers - Current"
              limit={10}
              minRelevance={0.7}
              algorithm="relevance"
              autoFetch={false}
            />
          </TabPanel>
        </Paper>
      )}

      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Database Statistics
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <Paper sx={{ p: 2, textAlign: "center", flex: "1 1 200px" }}>
            <Typography variant="h4" color="primary">
              3.7M+
            </Typography>
            <Typography variant="body2">Total Papers</Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: "center", flex: "1 1 200px" }}>
            <Typography variant="h4" color="secondary">
              778K+
            </Typography>
            <Typography variant="body2">High Relevance (0.8+)</Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: "center", flex: "1 1 200px" }}>
            <Typography variant="h4" color="success.main">
              206K+
            </Typography>
            <Typography variant="body2">2024 Papers</Typography>
          </Paper>
          <Paper sx={{ p: 2, textAlign: "center", flex: "1 1 200px" }}>
            <Typography variant="h4" color="warning.main">
              256K+
            </Typography>
            <Typography variant="body2">Highly Cited (100+)</Typography>
          </Paper>
        </Box>
      </Box>
    </Container>
  );
}

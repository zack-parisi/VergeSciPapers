"use client";
import React from "react";
import { useTheme, useMediaQuery, Box } from "@mui/material";

interface MobileOptimizationsProps {
  children: React.ReactNode;
  addBottomPadding?: boolean;
  addSafeArea?: boolean;
}

/**
 * MobileOptimizations component - provides mobile-specific enhancements
 * that don't affect desktop layout
 */
const MobileOptimizations: React.FC<MobileOptimizationsProps> = ({
  children,
  addBottomPadding = true,
  addSafeArea = true,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Don't apply mobile optimizations on desktop
  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <Box
      sx={{
        // Mobile-specific optimizations
        minHeight: "100vh",
        // Add safe area padding for devices with notches
        paddingTop: addSafeArea ? "env(safe-area-inset-top, 0px)" : 0,
        paddingBottom: addBottomPadding
          ? "calc(env(safe-area-inset-bottom, 0px) + 80px)" // Account for bottom navigation
          : "env(safe-area-inset-bottom, 0px)",
        paddingLeft: addSafeArea ? "env(safe-area-inset-left, 0px)" : 0,
        paddingRight: addSafeArea ? "env(safe-area-inset-right, 0px)" : 0,
        // Prevent horizontal scrolling
        overflowX: "hidden",
        // Optimize for touch
        WebkitOverflowScrolling: "touch",
        // Prevent text selection on mobile
        userSelect: "none",
        WebkitUserSelect: "none",
        // Prevent zoom on double tap
        touchAction: "manipulation",
      }}
    >
      {children}
    </Box>
  );
};

export default MobileOptimizations;

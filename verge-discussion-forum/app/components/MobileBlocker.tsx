"use client";
import React from "react";
import { useMediaQuery, useTheme } from "@mui/material";

interface MobileOnlyProps {
  children: React.ReactNode;
}

/**
 * MobileOnly component - only renders children on mobile devices
 * This ensures mobile-specific features don't affect desktop layout
 */
export const MobileOnly: React.FC<MobileOnlyProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  if (!isMobile) {
    return null;
  }

  return <>{children}</>;
};

/**
 * DesktopOnly component - only renders children on desktop devices
 * This ensures desktop-specific features don't affect mobile layout
 */
export const DesktopOnly: React.FC<MobileOnlyProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  if (isMobile) {
    return null;
  }

  return <>{children}</>;
};

/**
 * MobileBlocker - legacy component (now just a placeholder)
 * Previously blocked mobile users, now allows them
 */
export const MobileBlocker: React.FC = () => {
  return null; // Mobile users are now allowed
};

export default MobileBlocker;

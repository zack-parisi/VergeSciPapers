"use client";
import React, { useRef, useEffect, useState } from "react";
import { useTheme, useMediaQuery } from "@mui/material";

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface MobileTouchHandlerProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  swipeThreshold?: number;
  tapThreshold?: number;
  doubleTapDelay?: number;
}

const MobileTouchHandler: React.FC<MobileTouchHandlerProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onTap,
  onDoubleTap,
  swipeThreshold = 50,
  tapThreshold = 10,
  doubleTapDelay = 300,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const touchRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<TouchPoint | null>(null);
  const [lastTap, setLastTap] = useState<number>(0);

  useEffect(() => {
    if (!isMobile || !touchRef.current) return;

    const element = touchRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      setTouchStart({
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now(),
      });
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;
      const deltaTime = Date.now() - touchStart.timestamp;

      // Check if it's a tap (small movement, short duration)
      if (
        Math.abs(deltaX) < tapThreshold &&
        Math.abs(deltaY) < tapThreshold &&
        deltaTime < 200
      ) {
        const now = Date.now();
        if (now - lastTap < doubleTapDelay) {
          // Double tap
          onDoubleTap?.();
          setLastTap(0);
        } else {
          // Single tap
          onTap?.();
          setLastTap(now);
        }
      } else if (deltaTime > 100 && deltaTime < 1000) {
        // Check for swipes
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal swipe
          if (Math.abs(deltaX) > swipeThreshold) {
            if (deltaX > 0) {
              onSwipeRight?.();
            } else {
              onSwipeLeft?.();
            }
          }
        } else {
          // Vertical swipe
          if (Math.abs(deltaY) > swipeThreshold) {
            if (deltaY > 0) {
              onSwipeDown?.();
            } else {
              onSwipeUp?.();
            }
          }
        }
      }

      setTouchStart(null);
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Prevent default scrolling during swipe gestures
      if (touchStart) {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStart.x);
        const deltaY = Math.abs(touch.clientY - touchStart.y);

        if (deltaX > swipeThreshold || deltaY > swipeThreshold) {
          e.preventDefault();
        }
      }
    };

    element.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchmove", handleTouchMove);
    };
  }, [
    isMobile,
    touchStart,
    lastTap,
    swipeThreshold,
    tapThreshold,
    doubleTapDelay,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
  ]);

  // Don't add touch handling on desktop
  if (!isMobile) {
    return <React.Fragment>{children}</React.Fragment>;
  }

  return (
    <div
      ref={touchRef}
      style={{
        touchAction: "pan-y", // Allow vertical scrolling, prevent horizontal
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {children}
    </div>
  );
};

export default MobileTouchHandler;

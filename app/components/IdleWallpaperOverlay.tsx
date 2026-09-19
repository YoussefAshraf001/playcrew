"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";

type IdleWallpaperOverlayProps = {
  enabled: boolean;
  fadeAfterSeconds: number;
  src?: string | null;
  imageStyle?: CSSProperties;
};

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

export default function IdleWallpaperOverlay({
  enabled,
  fadeAfterSeconds,
  src,
  imageStyle,
}: IdleWallpaperOverlayProps) {
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    if (!enabled || !src) {
      clearIdleTimer();
      return;
    }

    const resetIdleTimer = () => {
      setIsIdle(false);
      clearIdleTimer();
      idleTimerRef.current = setTimeout(
        () => setIsIdle(true),
        fadeAfterSeconds * 1000,
      );
    };

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, resetIdleTimer),
    );
    resetIdleTimer();

    return () => {
      clearIdleTimer();
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, resetIdleTimer),
      );
    };
  }, [enabled, fadeAfterSeconds, src]);

  return (
    <AnimatePresence>
      {enabled && isIdle && src && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden bg-[var(--theme-bg)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: "easeInOut" }}
        >
          <motion.img
            src={src}
            alt="Idle wallpaper"
            className="h-full w-full object-cover"
            style={{ ...imageStyle, filter: "none" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface GlitchTextProps {
  text: string | number;
  className?: string;
  sliceHeight?: number; // height of each slice in px
}

export default function Glitch({
  text,
  className = "",
  sliceHeight = 6,
}: GlitchTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [slicesCount, setSlicesCount] = useState(1);

  useEffect(() => {
    if (containerRef.current) {
      const height = containerRef.current.offsetHeight;
      setSlicesCount(Math.ceil(height / sliceHeight));
    }
  }, [text, sliceHeight]);

  const colors = ["#fff", "#0ff", "#f0f", "#000"];
  const str = String(text);

  return (
    <span
      ref={containerRef}
      className={`relative inline-block ${className}`}
      style={{ display: "inline-block", fontFamily: "monospace" }}
    >
      {Array.from({ length: slicesCount }).map((_, i) => {
        const xOffset = Math.random() * 6 - 3;
        const yOffset = Math.random() * 4 - 2;
        const rotateOffset = Math.random() * 6 - 3;
        const color = colors[Math.floor(Math.random() * colors.length)];

        return (
          <motion.span
            key={i}
            style={{
              display: "inline-block",
              position: "absolute",
              top: `${i * sliceHeight}px`,
              left: 0,
              width: "100%",
              height: `${sliceHeight}px`,
              overflow: "hidden",
              color,
            }}
            animate={{
              x: [0, xOffset, -xOffset, 0],
              y: [0, yOffset, -yOffset, 0],
              rotate: [0, rotateOffset, -rotateOffset, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: 0.4 + Math.random() * 0.3,
              ease: "linear",
              repeatType: "loop",
              delay: Math.random() * 0.2,
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `translateY(-${i * sliceHeight}px)`,
              }}
            >
              {str}
            </span>
          </motion.span>
        );
      })}

      {/* Base text to preserve spacing */}
      <span style={{ visibility: "hidden" }}>{str}</span>
    </span>
  );
}

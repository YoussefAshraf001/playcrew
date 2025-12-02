import { motion } from "framer-motion";
import { useRef, useEffect, useState } from "react";

interface MarqueeProps {
  text: string;
  className?: string;
  speed?: number; // pixels per second
}

export default function MarqueeText({
  text,
  className = "",
  speed = 40,
}: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [textWidth, setTextWidth] = useState(0);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const width = textRef.current?.scrollWidth ?? 0;

    setTextWidth(width);
    setShouldScroll(width > containerWidth);
  }, [text]);

  if (!text) return null;

  // Duration based on text width and speed
  const duration = textWidth / speed;

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap max-w-[200px] ${className}`}
    >
      {shouldScroll ? (
        <motion.div
          className="inline-flex"
          animate={{ x: [-0, -textWidth] }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration,
              ease: "linear",
            },
          }}
        >
          <div ref={textRef} className="inline-block">
            {text}&nbsp;&nbsp;&nbsp;
          </div>
          <div className="inline-block">{text}&nbsp;&nbsp;&nbsp;</div>{" "}
          {/* duplicate for smooth loop */}
        </motion.div>
      ) : (
        <div ref={textRef} className="inline-block">
          {text}
        </div>
      )}
    </div>
  );
}

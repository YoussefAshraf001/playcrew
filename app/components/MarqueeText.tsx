import { motion } from "framer-motion";
import { useRef, useEffect, useState } from "react";

interface MarqueeProps {
  text: string;
  className?: string;
  speed?: number;
  loopForever?: boolean;
}

export default function MarqueeText({
  text,
  className = "",
  speed = 40,
  loopForever = false,
}: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [duration, setDuration] = useState(10);

  useEffect(() => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    const textWidth = textRef.current?.scrollWidth ?? 0;

    const scroll = loopForever || textWidth > containerWidth;
    setShouldScroll(scroll);

    if (scroll && textWidth) {
      setDuration(textWidth / speed);
    }
  }, [text, speed, loopForever]);

  if (!text) return null;

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap w-full ${className}`}
    >
      {shouldScroll ? (
        <motion.div
          className="flex w-max"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          <div ref={textRef} className="shrink-0 pr-8">
            {text}
          </div>
          <div className="shrink-0 pr-8">{text}</div>
        </motion.div>
      ) : (
        <div ref={textRef}>{text}</div>
      )}
    </div>
  );
}

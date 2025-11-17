"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Screenshot {
  id?: number | string;
  image: string;
}

interface ScreenshotsCarouselProps {
  screenshots?: Screenshot[]; // make optional to avoid undefined
}

export default function ScreenshotsCarousel({
  screenshots = [], // default empty array
}: ScreenshotsCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  // scroll position ref
  const scrollPosRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || screenshots.length === 0) return;

    let animationFrame: number;
    const speed = 0.5; // pixels per frame

    const scroll = () => {
      if (!isHovered) {
        scrollPosRef.current += speed;
        if (scrollPosRef.current >= container.scrollWidth / 2) {
          scrollPosRef.current -= container.scrollWidth / 2; // wrap around
        }
        container.scrollLeft = scrollPosRef.current;
      }
      animationFrame = requestAnimationFrame(scroll);
    };

    animationFrame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationFrame);
  }, [isHovered, screenshots]);

  const handleOpenModal = (src: string) => {
    setActiveImage(src);
    setModalOpen(true);
  };

  const handleDownload = (src: string) => {
    const link = document.createElement("a");
    link.href = src;
    link.download = "screenshot.jpg";
    link.click();
  };

  // Duplicate screenshots for seamless scrolling, only if non-empty
  const allScreenshots =
    screenshots.length > 0 ? [...screenshots, ...screenshots] : [];

  if (allScreenshots.length === 0) return null; // don't render carousel if empty

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex gap-4 overflow-x-hidden cursor-pointer"
      >
        {allScreenshots.map((s, i) => (
          <img
            key={i}
            src={s.image}
            alt={`screenshot ${i + 1}`}
            className="h-48 w-auto object-cover rounded-lg shadow-md"
            onClick={() => handleOpenModal(s.image)}
          />
        ))}
      </div>

      <AnimatePresence>
        {modalOpen && activeImage && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-red-500 z-50"
              onClick={() => setModalOpen(false)}
            >
              &times;
            </button>

            <img
              src={activeImage}
              alt="screenshot fullscreen"
              className="max-w-[95%] max-h-[90%] object-contain"
            />

            <button
              className="absolute bottom-8 right-4 px-4 py-2 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400"
              onClick={() => handleDownload(activeImage)}
            >
              Download
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoCloseCircle } from "react-icons/io5";

interface Screenshot {
  id?: number | string;
  image: string;
}

interface ScreenshotsCarouselProps {
  screenshots?: Screenshot[];
}

export default function ScreenshotsCarousel({
  screenshots = [],
}: ScreenshotsCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const scrollPosRef = useRef(0);

  // Seamless scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container || screenshots.length === 0) return;

    let animationFrame: number;
    const speed = 0.5;

    const scroll = () => {
      if (!isHovered) {
        scrollPosRef.current += speed;
        if (scrollPosRef.current >= container.scrollWidth / 2) {
          scrollPosRef.current -= container.scrollWidth / 2;
        }
        container.scrollLeft = scrollPosRef.current;
      }
      animationFrame = requestAnimationFrame(scroll);
    };

    animationFrame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationFrame);
  }, [isHovered, screenshots]);

  const handleOpenModal = (index: number) => {
    setActiveIndex(index);
    setModalOpen(true);
  };

  const handleDownload = async (screenshot: Screenshot) => {
    try {
      const res = await fetch(screenshot.image);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `screenshot-${screenshot.id ?? Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download image:", err);
    }
  };

  const handlePrev = () =>
    setActiveIndex(
      (prev) => (prev - 1 + screenshots.length) % screenshots.length
    );
  const handleNext = () =>
    setActiveIndex((prev) => (prev + 1) % screenshots.length);

  const allScreenshots =
    screenshots.length > 1 ? [...screenshots, ...screenshots] : screenshots;

  // ✅ NEW: If no screenshots → show centered placeholder
  if (screenshots.length === 0) {
    return (
      <div className="w-full h-48 flex items-center justify-center">
        <div
          className="h-48 w-64 flex items-center justify-center 
        bg-zinc-900/50 rounded-lg border border-zinc-700 text-zinc-400 text-sm"
        >
          No screenshots available
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Thumbnail carousel */}
      <div
        ref={containerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex gap-4 overflow-hidden cursor-pointer"
      >
        {allScreenshots.map((s, i) => (
          <motion.img
            key={i}
            src={s.image}
            alt={`screenshot ${i + 1}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="h-48 w-84 object-cover rounded-lg shadow-md"
            onClick={() => handleOpenModal(i % screenshots.length)}
          />
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative flex flex-col items-center">
              {/* Close button */}
              <button
                className="absolute cursor-pointer hover:scale-105 ease-in-out duration-200 transition-all top-4 right-4 text-red-500 text-3xl font-bold z-50"
                onClick={() => setModalOpen(false)}
              >
                <IoCloseCircle size={35} />
              </button>

              {/* Carousel image */}
              <motion.img
                key={activeIndex}
                src={screenshots[activeIndex].image}
                alt={`screenshot ${activeIndex + 1}`}
                className="w-[70vw] h-[70vh] object-cover rounded-lg shadow-lg"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              />

              {/* Navigation buttons */}
              <div className="absolute inset-x-0 flex justify-between top-1/2 transform -translate-y-1/2 px-4">
                <button
                  onClick={handlePrev}
                  className="cursor-pointer hover:scale-105 ease-in-out duration-200 transition-all text-white bg-black/40 hover:bg-black/60 px-2 py-4 rounded-full"
                >
                  &#10094;
                </button>
                <button
                  onClick={handleNext}
                  className="cursor-pointer hover:scale-105 ease-in-out duration-200 transition-all text-white bg-black/40 hover:bg-black/60 px-2 py-4 rounded-full"
                >
                  &#10095;
                </button>
              </div>

              {/* Download button */}
              <button
                className="cursor-pointer hover:scale-105 ease-in-out duration-300 transition-all mt-4 px-4 py-2 
             bg-cyan-500 text-black font-semibold rounded-lg
             hover:outline hover:outline-cyan-500
             hover:bg-black hover:text-cyan-500"
                onClick={() => handleDownload(screenshots[activeIndex])}
              >
                Download
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

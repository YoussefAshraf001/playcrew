"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoCloseCircle } from "react-icons/io5";
import { MdOutlineFileDownload } from "react-icons/md";

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
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  const scrollPosRef = useRef(0);

  const handleImageLoad = (src: string) => {
    setLoadedImages((prev) => ({ ...prev, [src]: true }));
  };

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
      (prev) => (prev - 1 + screenshots.length) % screenshots.length,
    );

  const handleNext = () =>
    setActiveIndex((prev) => (prev + 1) % screenshots.length);

  const allScreenshots =
    screenshots.length > 1 ? [...screenshots, ...screenshots] : screenshots;

  if (screenshots.length === 0) {
    return (
      <div className="w-full max-w-[1400px] mx-auto h-48 flex items-center justify-center">
        <div className="h-48 w-64 flex items-center justify-center bg-zinc-900/50 rounded-lg border border-zinc-700 text-zinc-400 text-sm">
          No screenshots available
        </div>
      </div>
    );
  }

  const THUMBNAIL_WIDTH = 336;
  const THUMBNAIL_HEIGHT = 192;

  return (
    <>
      {/* Thumbnail carousel */}
      <div
        ref={containerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex gap-4 overflow-x-auto hide-scrollbar w-full max-w-[1400px] mx-auto cursor-pointer"
      >
        {allScreenshots.map((s, i) => (
          <div
            key={i}
            className="relative shrink-0 overflow-hidden rounded-lg"
            style={{
              width: THUMBNAIL_WIDTH,
              height: THUMBNAIL_HEIGHT,
            }}
          >
            {/* Skeleton */}
            {!loadedImages[s.image] && (
              <div className="absolute inset-0 rounded-lg bg-zinc-800 animate-pulse" />
            )}

            <motion.img
              src={s.image}
              alt={`screenshot ${i + 1}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onLoad={() => handleImageLoad(s.image)}
              className="shadow-md"
              style={{
                width: THUMBNAIL_WIDTH,
                height: THUMBNAIL_HEIGHT,
                objectFit: "cover",
                opacity: loadedImages[s.image] ? 1 : 0,
                transition: "opacity 0.4s ease",
              }}
              onClick={() => handleOpenModal(i % screenshots.length)}
            />
          </div>
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
            onClick={() => setModalOpen(false)}
          >
            <div
              className="relative flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                aria-label="Close screenshot viewer"
                className="absolute top-4 right-4 z-50 h-11 w-11 rounded-full border border-white/30 bg-black/50 text-red-300 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-105 hover:bg-black/75 hover:border-red-300/70 hover:text-red-200 active:scale-95"
                onClick={() => setModalOpen(false)}
              >
                <IoCloseCircle size={28} />
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
                  aria-label="Previous screenshot"
                  className="cursor-pointer h-11 w-11 rounded-full border border-white/30 bg-black/45 text-white text-xl backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-black/70 hover:border-cyan-300/70 active:scale-95 flex items-center justify-center"
                >
                  &#10094;
                </button>
                <button
                  onClick={handleNext}
                  aria-label="Next screenshot"
                  className="cursor-pointer h-11 w-11 rounded-full border border-white/30 bg-black/45 text-white text-xl backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-black/70 hover:border-cyan-300/70 active:scale-95 flex items-center justify-center"
                >
                  &#10095;
                </button>
              </div>

              {/* Download button */}
              <button
                className="cursor-pointer hover:scale-105 ease-in-out duration-300 transition-all mt-4 px-4 py-2 flex items-center gap-2
             bg-cyan-500 text-black font-semibold rounded-lg
             hover:outline hover:outline-cyan-500
             hover:bg-black hover:text-cyan-500"
                onClick={() => handleDownload(screenshots[activeIndex])}
              >
                <MdOutlineFileDownload size={18} />
                Download
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Video {
  id: number | string;
  thumbnail: string;
  videoId: string;
}

interface VideoCarouselProps {
  videos: Video[];
}

export default function VideoCarousel({ videos }: VideoCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isHovered, setIsHovered] = useState(false);
  const [loadedThumbs, setLoadedThumbs] = useState<Record<string, boolean>>({});

  const scrollPosRef = useRef(0);

  const handleThumbLoad = (src: string) => {
    setLoadedThumbs((prev) => ({ ...prev, [src]: true }));
  };

  const openModal = (index: number) => {
    setActiveIndex(index);
    setModalOpen(true);
  };

  const safeVideos = Array.isArray(videos) ? videos : [];
  const allVideos =
    safeVideos.length > 1 ? [...safeVideos, ...safeVideos] : safeVideos;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || videos.length === 0) return;

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
  }, [videos, isHovered]);

  if (!Array.isArray(videos) || videos.length === 0) {
    return (
      <div className="flex gap-4 overflow-x-auto hide-scrollbar lg:w-[1360px] cursor-pointer">
        <div className="w-full h-48 flex items-center justify-center text-zinc-400">
          No Videos Available
        </div>
      </div>
    );
  }

  const THUMBNAIL_WIDTH = 336;
  const THUMBNAIL_HEIGHT = 192;

  return (
    <>
      {/* Thumbnails */}
      <div
        ref={containerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex gap-4 overflow-x-auto hide-scrollbar lg:w-[1360px] cursor-pointer"
      >
        {allVideos.map((v, i) => (
          <div
            key={i}
            className="relative shrink-0 overflow-hidden rounded-lg"
            style={{
              width: THUMBNAIL_WIDTH,
              height: THUMBNAIL_HEIGHT,
            }}
            onClick={() => openModal(i % videos.length)}
          >
            {/* Skeleton */}
            {!loadedThumbs[v.thumbnail] && (
              <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
            )}

            {/* SCALE THE WRAPPER, NOT THE IMAGE */}
            <motion.div
              className="w-full h-full"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <img
                src={v.thumbnail}
                alt={`Video thumbnail ${i + 1}`}
                onLoad={() => handleThumbLoad(v.thumbnail)}
                className="w-full h-full object-cover"
                style={{
                  opacity: loadedThumbs[v.thumbnail] ? 1 : 0,
                  transition: "opacity 0.4s ease",
                }}
              />

              {/* Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                <span className="text-white text-4xl">▶</span>
              </div>
            </motion.div>
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
            <motion.div
              className="relative w-full max-w-5xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={`https://www.youtube.com/embed/${videos[activeIndex].videoId}?autoplay=1&rel=0&modestbranding=1`}
                className="w-full aspect-video rounded-xl shadow-2xl"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title={videos[activeIndex].videoId}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

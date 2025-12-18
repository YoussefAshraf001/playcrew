import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

interface PosterImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
}

export default function PosterImage({ src, alt, className }: PosterImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Blur placeholder */}
      {!loaded && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse rounded-xl" />
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="absolute inset-0"
      >
        <div className="relative w-full h-56">
          <img
            src={src}
            alt={alt}
            className="absolute inset-0 w-full h-full object-cover rounded-t-xl transition-opacity duration-500"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </motion.div>
    </div>
  );
}

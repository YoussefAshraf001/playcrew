import { motion } from "framer-motion";
import { FiCloud, FiArrowUp } from "react-icons/fi";

export default function UploadIconSmall({ progress }: { progress: number }) {
  const uploading = progress < 100;

  return (
    <div className="relative w-5 h-5">
      {/* Cloud */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center text-cyan-400"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <FiCloud size={20} />
      </motion.div>

      {/* Arrow */}
      <motion.div
        className="absolute left-1/2 top-2 -translate-x-1/2 text-cyan-300"
        animate={{
          y: [0, -8],
          opacity: [0, 1, 0],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <FiArrowUp size={15} />
      </motion.div>
    </div>
  );
}

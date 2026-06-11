import { motion } from "framer-motion";
import { IoCloseSharp } from "react-icons/io5";

interface OverviewPanelProps {
  level: number;
  totalXP: number;
  gameStats: Record<string, number>;
  gameXP: Array<{ status?: string; displayXP: number }>;
  onClose: () => void;
}

export default function OverviewPanel({
  level,
  totalXP,
  gameStats,
  gameXP,
  onClose,
}: OverviewPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: 120,
        transition: {
          duration: 0.4,
          ease: [0.22, 1, 0.36, 1],
        },
      }}
      transition={{
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative rounded-2xl border border-white/10 px-4 sm:px-6 md:px-12 py-5 sm:py-7 md:py-10 max-h-[72vh] overflow-y-auto"
    >
      {/* ───────── BACKGROUND BLUR LAYER (NO TEXT HERE) ───────── */}
      <div className="absolute inset-0 rounded-2xl bg-black/40 backdrop-blur-sm" />

      {/* ───────── CONTENT LAYER ───────── */}
      <div className="relative z-10">
        <motion.button
          type="button"
          onClick={onClose}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="absolute right-0 top-0 text-xs sm:text-sm px-2 py-2 rounded-full border border-white/20 text-zinc-300 hover:text-white hover:border-cyan-300 transition-all duration-300 cursor-pointer"
        >
          <IoCloseSharp size={20} />
        </motion.button>

        <h3 className="uppercase text-sm tracking-[0.3em] text-zinc-300 mb-8 text-center">
          Account Overview
        </h3>

        <div className="space-y-5 sm:space-y-8 text-sm text-zinc-400 min-h-0 sm:min-h-[400px] flex flex-col items-center justify-center">
          {/* ───────── XP SUMMARY ───────── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ delay: 0.1 }}
            className="
              w-full max-w-md flex items-center justify-around
              bg-black/30
              p-4 sm:p-6 rounded-2xl
              border border-cyan-500/20
            "
          >
            <div className="text-center">
              <p className="text-2xl sm:text-4xl font-bold text-cyan-400">
                Level
              </p>
              <p className="text-2xl sm:text-4xl font-extrabold text-cyan-400">
                {level}
              </p>
            </div>

            <div className="text-center border-l border-cyan-500/10 pl-4 sm:pl-6">
              <p className="text-2xl sm:text-3xl font-bold text-cyan-400">
                {Math.round(totalXP)}
              </p>
              <p className="text-xs sm:text-sm text-zinc-400">XP</p>
            </div>
          </motion.div>

          {/* ───────── STATS GRID ───────── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ delay: 0.2 }}
            className="
              w-full max-w-4xl flex flex-wrap justify-center gap-4 sm:gap-8
              bg-black/30
              p-4 sm:p-8 rounded-2xl
              border border-cyan-500/20
            "
          >
            {Object.entries(gameStats).map(([label, value]) => {
              const categoryXP = gameXP
                .filter((g) => g.status === label)
                .reduce((acc, g) => acc + g.displayXP, 0);

              return (
                <div
                  key={label}
                  className="text-center min-w-[90px] sm:min-w-[110px]"
                >
                  <p className="text-2xl sm:text-3xl font-bold text-cyan-400">
                    {value}
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-400">{label}</p>

                  {label !== "All" && (
                    <p className="text-xs sm:text-sm text-zinc-500">
                      {label === "Dropped" && "-"}
                      {label === "On Hold" && "±"}
                      {categoryXP} XP
                    </p>
                  )}
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

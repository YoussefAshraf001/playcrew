import { motion } from "framer-motion";

interface OverviewPanelProps {
  level: number;
  totalXP: number;
  gameStats: Record<string, number>;
  gameXP: any[];
}

export default function OverviewPanel({
  level,
  totalXP,
  gameStats,
  gameXP,
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
      className="relative rounded-2xl border border-white/10 px-12 py-10"
    >
      {/* ───────── BACKGROUND BLUR LAYER (NO TEXT HERE) ───────── */}
      <div className="absolute inset-0 rounded-2xl bg-black/40 backdrop-blur-sm" />

      {/* ───────── CONTENT LAYER ───────── */}
      <div className="relative z-10">
        <h3 className="uppercase text-sm tracking-[0.3em] text-zinc-300 mb-8 text-center">
          Account Overview
        </h3>

        <div className="space-y-8 text-sm text-zinc-400 min-h-[400px] flex flex-col items-center justify-center">
          {/* ───────── XP SUMMARY ───────── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ delay: 0.1 }}
            className="
              w-full max-w-md flex items-center justify-around
              bg-black/30
              p-6 rounded-2xl
              border border-cyan-500/20
            "
          >
            <div className="text-center">
              <p className="text-4xl font-bold text-cyan-400">Level</p>
              <p className="text-4xl font-extrabold text-cyan-400">{level}</p>
            </div>

            <div className="text-center border-l border-cyan-500/10 pl-6">
              <p className="text-3xl font-bold text-cyan-400">
                {Math.round(totalXP)}
              </p>
              <p className="text-sm text-zinc-400">XP</p>
            </div>
          </motion.div>

          {/* ───────── STATS GRID ───────── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ delay: 0.2 }}
            className="
              w-full max-w-4xl flex flex-wrap justify-center gap-8
              bg-black/30
              p-8 rounded-2xl
              border border-cyan-500/20
            "
          >
            {Object.entries(gameStats).map(([label, value]) => {
              const categoryXP = gameXP
                .filter((g) => g.status === label)
                .reduce((acc, g) => acc + g.displayXP, 0);

              return (
                <div key={label} className="text-center min-w-[110px]">
                  <p className="text-3xl font-bold text-cyan-400">{value}</p>
                  <p className="text-sm text-zinc-400">{label}</p>

                  {label !== "All" && (
                    <p className="text-sm text-zinc-500">
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

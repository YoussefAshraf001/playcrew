"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { FiPieChart } from "react-icons/fi";

type GenreGame = {
  igdb?: { genres?: string[] };
};

const COLORS = [
  "rgb(var(--theme-accent-rgb))",
  "color-mix(in srgb, rgb(var(--theme-accent-rgb)) 72%, white)",
  "color-mix(in srgb, rgb(var(--theme-accent-rgb)) 55%, #7dd3fc)",
  "color-mix(in srgb, rgb(var(--theme-accent-rgb)) 58%, #a78bfa)",
  "color-mix(in srgb, rgb(var(--theme-accent-rgb)) 42%, #71717a)",
  "color-mix(in srgb, rgb(var(--theme-accent-rgb)) 28%, #27272a)",
  "#f472b6",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#2dd4bf",
  "#60a5fa",
  "#818cf8",
  "#c084fc",
];

export default function CollectionGenreChart({
  games,
}: {
  games: GenreGame[];
}) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    games.forEach((game) => {
      new Set(game.igdb?.genres ?? []).forEach((genre) => {
        const clean = genre.trim();
        if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
      });
    });

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.map(([label, value]) => ({ label, value }));
  }, [games]);

  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient = data.length
    ? `conic-gradient(${data
        .map((item, index) => {
          const start = cursor;
          cursor += (item.value / total) * 100;
          return `${COLORS[index % COLORS.length]} ${start}% ${cursor}%`;
        })
        .join(", ")})`
    : "conic-gradient(rgba(255,255,255,.08) 0 100%)";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="theme-panel relative w-full overflow-hidden rounded-2xl border p-4 shadow-[0_16px_40px_rgba(var(--theme-accent-rgb),0.13)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--theme-accent-rgb),0.14),transparent_62%)]" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="theme-accent-soft-bg grid h-8 w-8 place-items-center rounded-xl border">
            <FiPieChart className="theme-accent-text" />
          </span>
          <div>
            <p className="theme-text text-sm font-bold">Genre profile</p>
            <p className="theme-text-muted text-[10px]">What you play most</p>
          </div>
        </div>

        {data.length ? (
          <div className="mt-1 flex flex-col items-center gap-4">
            <div
              className="relative h-26 w-26 shrink-0 rounded-full shadow-[0_0_28px_rgba(var(--theme-accent-rgb),0.2)]"
              style={{ background: gradient }}
              role="img"
              aria-label={data
                .map((item) => `${item.label}: ${item.value}`)
                .join(", ")}
            >
              <div className="theme-panel-strong absolute inset-[24%] grid place-items-center rounded-full border border-white/10">
                <span className="theme-text text-lg font-black">
                  {games.length}
                </span>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 border-t border-white/8 pt-3">
              {data.map((item, index) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: COLORS[index % COLORS.length] }}
                  />
                  <span
                    className="theme-text-muted min-w-0 flex-1 truncate"
                    title={item.label}
                  >
                    {item.label}
                  </span>
                  <span className="theme-text font-semibold">
                    {Math.round((item.value / total) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="theme-text-muted mt-4 rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-xs">
            Genre data will appear as games are added.
          </div>
        )}
      </div>
    </motion.section>
  );
}

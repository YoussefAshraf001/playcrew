import { FaRedo } from "react-icons/fa";
import type { PlayAgain } from "@/app/types/trackedGame";
import { getPlaythroughLabel } from "@/app/lib/gameRuns";

export default function PlayAgainBadge({ value, showLabel = false, runNumber }: { value?: PlayAgain; showLabel?: boolean; runNumber?: number }) {
  if (value !== "replay" && value !== "another-chance") return null;
  const kind = value === "replay" ? "Replay" : "Another chance";
  const label = runNumber && runNumber > 1 ? `${getPlaythroughLabel(runNumber)} · ${kind}` : kind;
  return (
    <span tabIndex={0} aria-label={label} className="group/replay relative inline-flex items-center gap-2 rounded-lg border border-purple-300/20 bg-zinc-950/90 p-2 text-xs text-purple-300">
      <FaRedo size={12} aria-hidden="true" />
      {!showLabel && runNumber && runNumber > 1 ? <span>{getPlaythroughLabel(runNumber)}</span> : null}
      {showLabel ? label : (
        <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white opacity-0 transition group-hover/replay:opacity-100 group-focus/replay:opacity-100">{label}</span>
      )}
    </span>
  );
}

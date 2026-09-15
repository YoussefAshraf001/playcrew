import type { GameRunState } from "@/app/types/trackedGame";
import { parseReleaseDate } from "@/app/lib/releaseDates";
import GameSticker from "./GameSticker";
import { getPlaythroughLabel } from "@/app/lib/gameRuns";

const dateLabel = (value: unknown) => parseReleaseDate(value)?.toLocaleString() ?? "Not recorded";
const kindLabel = (kind: GameRunState["runKind"]) => kind === "replay" ? " · Replay" : kind === "another-chance" ? " · Another chance" : "";

export default function GameRunHistory({ state }: { state: GameRunState }) {
  if (state.runNumber <= 1 && !state.runKind && state.runHistory.length === 0) return null;
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4 text-white">
      <div className="text-sm font-semibold">{getPlaythroughLabel(state.runNumber)}{kindLabel(state.runKind)}</div>
      <p className="mt-1 text-xs text-white/50">Started: {dateLabel(state.runStartedAt)}</p>
      {state.runHistory.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-purple-300">Previous playthroughs ({state.runHistory.length})</summary>
          <div className="mt-3 space-y-3">
            {[...state.runHistory].reverse().map((run) => (
              <details key={run.number} className="rounded-xl border border-white/10 p-3">
                <summary className="cursor-pointer text-sm">{getPlaythroughLabel(run.number)}{kindLabel(run.kind)} · {run.status}</summary>
                <div className="mt-3 space-y-2 text-xs text-white/65">
                  <p>Started: {dateLabel(run.startedAt)}</p>
                  <p>Archived: {dateLabel(run.archivedAt)}</p>
                  <p>Last updated: {dateLabel(run.lastUpdated)}</p>
                  <p>Rating: {run.my_rating ?? "Not rated"} · Playtime: {run.playtime}h · Progress: {run.progress}%</p>
                  <p>Played on: {run.playedOn.join(", ") || "Not recorded"}</p>
                  <p>Favorite: {run.favorite ? "Yes" : "No"} · Lost interest: {run.notInterested ? "Yes" : "No"}</p>
                  {run.preReleaseAccess && <p>Access: {run.preReleaseAccess.type} · {dateLabel(run.preReleaseAccess.unlockedAt)}</p>}
                  <p className="whitespace-pre-wrap break-words text-sm text-white/90">{run.review.text || "No review for this playthrough."}</p>
                  {run.review.sticker && (/^https:\/\//.test(run.review.sticker)
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={run.review.sticker} alt="Playthrough review sticker" className="h-28 w-28 object-contain" />
                    : <GameSticker stickerId={run.review.sticker} />)}
                  {run.review.createdAt && <p>Review created: {dateLabel(run.review.createdAt)}</p>}
                  {run.review.updatedAt && <p>Review updated: {dateLabel(run.review.updatedAt)}</p>}
                  <details>
                    <summary className="cursor-pointer">Play sessions ({run.playedSessions.length})</summary>
                    {run.playedSessions.map((session, index) => <p key={index} className="mt-2">{dateLabel(session.playedAt)} · {session.durationHours}h</p>)}
                  </details>
                </div>
              </details>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

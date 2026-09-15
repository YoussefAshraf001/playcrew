import type { GameRunState, PlayAgain, TrackedGame } from "../types/trackedGame";

export function getPlaythroughLabel(number: number): string {
  const lastTwo = number % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" }[number % 10] ?? "th");
  return `${number}${suffix} playthrough`;
}

export function getGameRunState(game: Partial<TrackedGame> | null): GameRunState {
  return {
    runNumber: game?.runNumber ?? 1,
    runKind: game?.runKind ?? null,
    runStartedAt: game?.runStartedAt ?? null,
    runHistory: game?.runHistory ?? [],
  };
}

/** Archives the current draft and creates an empty run in one saveable value. */
export function startGameRun(game: TrackedGame, kind: Exclude<PlayAgain, null>, now = new Date()) {
  const state = getGameRunState(game);
  const archived = {
    number: state.runNumber,
    kind: state.runKind,
    startedAt: state.runStartedAt,
    archivedAt: now,
    lastUpdated: game.lastUpdated ?? null,
    review: {
      text: game.review?.text ?? "",
      sticker: game.review?.sticker ?? null,
      createdAt: game.review?.createdAt ?? null,
      updatedAt: game.review?.updatedAt ?? null,
    },
    my_rating: game.my_rating ?? null,
    playtime: game.playtime ?? 0,
    progress: game.progress ?? 0,
    status: game.status ?? "Want To Play",
    playedSessions: game.playedSessions ?? [],
    playedOn: Array.isArray(game.playedOn) ? game.playedOn : game.playedOn ? [game.playedOn] : [],
    favorite: game.favorite ?? false,
    notInterested: game.notInterested ?? false,
    preReleaseAccess: game.preReleaseAccess ?? null,
  };
  return {
    runNumber: state.runNumber + 1,
    runKind: kind,
    runStartedAt: now,
    runHistory: [...state.runHistory, archived],
    review: { text: "", sticker: null, createdAt: null, updatedAt: null },
    my_rating: null,
    playtime: 0,
    progress: 0,
    status: "Playing",
    playedSessions: [],
    playedOn: [],
    notInterested: false,
    playAgain: null,
  } satisfies Partial<TrackedGame> & GameRunState;
}

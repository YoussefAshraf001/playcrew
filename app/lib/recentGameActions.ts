export interface RecentActionTrackedGame {
  name?: string;
  favorite?: boolean;
  status?: string;
  progress?: number | null;
  my_rating?: number | null;
  notes?: string | null;
  playtime?: number | null;
}

const normalizeNumber = (value: unknown) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export function getRecentGameActionSummary(
  previous: RecentActionTrackedGame | null | undefined,
  next: RecentActionTrackedGame,
  options?: { defaultSummary?: string },
) {
  const defaultSummary = options?.defaultSummary ?? "Game Updated";

  if (!previous) {
    return "Added to Library";
  }

  if ((previous.favorite ?? false) !== (next.favorite ?? false)) {
    return next.favorite ? "Added to Favorites" : "Removed from Favorites";
  }

  const previousStatus = normalizeText(previous.status);
  const nextStatus = normalizeText(next.status);
  if (previousStatus !== nextStatus && nextStatus) {
    return `Status Changed to ${nextStatus}`;
  }

  const previousProgress = normalizeNumber(previous.progress);
  const nextProgress = normalizeNumber(next.progress);
  if (previousProgress !== nextProgress && nextProgress !== null) {
    if (previousProgress === null) {
      return `Progress Set to ${nextProgress}%`;
    }

    return nextProgress > previousProgress
      ? `Progress Increased to ${nextProgress}%`
      : `Progress Decreased to ${nextProgress}%`;
  }

  const previousRating = normalizeNumber(previous.my_rating);
  const nextRating = normalizeNumber(next.my_rating);
  if (previousRating !== nextRating) {
    if (nextRating === null) {
      return "Rating Cleared";
    }

    return previousRating === null
      ? `Rated the Game ${nextRating}`
      : `Rating Changed to ${nextRating}`;
  }

  const previousNotes = normalizeText(previous.notes);
  const nextNotes = normalizeText(next.notes);
  if (previousNotes !== nextNotes) {
    return nextNotes ? "Review Edited" : "Review Removed";
  }

  const previousPlaytime = normalizeNumber(previous.playtime);
  const nextPlaytime = normalizeNumber(next.playtime);
  if (previousPlaytime !== nextPlaytime && nextPlaytime !== null) {
    return nextPlaytime > (previousPlaytime ?? 0)
      ? `Playtime Increased to ${nextPlaytime}h`
      : `Playtime Decreased to ${nextPlaytime}h`;
  }

  return defaultSummary;
}

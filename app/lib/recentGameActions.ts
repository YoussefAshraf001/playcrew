export interface RecentActionTrackedGame {
  name?: string;
  favorite?: boolean;
  status?: string;
  progress?: number | null;
  my_rating?: number | null;
  notes?: string | null;
  playtime?: number | null;
  saveUploads?: Array<{ id?: string }> | null;
}

const normalizeNumber = (value: unknown) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const formatDuration = (hoursValue: number) => {
  const totalMinutes = Math.max(0, Math.round(hoursValue * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
};

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
    const diff = Math.abs(nextPlaytime - (previousPlaytime ?? 0));
    const formatted = formatDuration(diff);

    return nextPlaytime > (previousPlaytime ?? 0)
      ? `Logged ${formatted} play session`
      : `Playtime Decreased by ${formatted}`;
  }

  const previousSaveUploads = previous.saveUploads?.length ?? 0;
  const nextSaveUploads = next.saveUploads?.length ?? 0;
  if (previousSaveUploads !== nextSaveUploads) {
    return nextSaveUploads > previousSaveUploads
      ? "Save Backup Uploaded"
      : "Save Backup Removed";
  }

  return defaultSummary;
}

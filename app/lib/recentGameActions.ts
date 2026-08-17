export interface RecentActionTrackedGame {
  name?: string;
  favorite?: boolean;
  notInterested?: boolean;
  status?: string;
  progress?: number | null;
  my_rating?: number | null;
  review?: {
    text?: string;
    sticker?: string | null;
  };
  playtime?: number | null;
  playedSessions?: unknown[] | null;
  saveUploads?: Array<{ id?: string }> | null;
}
const normalizeNumber = (value: unknown) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return value;
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const getSessionKey = (session: unknown) => {
  if (!session || typeof session !== "object") return "";

  const item = session as {
    playedAt?: unknown;
    durationHours?: unknown;
  };
  const playedAt = item.playedAt;
  let timestamp = "";

  if (
    playedAt &&
    typeof playedAt === "object" &&
    "toDate" in playedAt &&
    typeof (playedAt as { toDate?: unknown }).toDate === "function"
  ) {
    timestamp = String((playedAt as { toDate: () => Date }).toDate().getTime());
  } else if (
    playedAt &&
    typeof playedAt === "object" &&
    "seconds" in playedAt
  ) {
    timestamp = String(
      Number((playedAt as { seconds: number }).seconds) * 1000,
    );
  } else {
    const parsed = new Date(playedAt as string | number | Date).getTime();
    timestamp = Number.isNaN(parsed) ? "" : String(parsed);
  }

  return `${timestamp}:${Number(item.durationHours) || 0}`;
};

const playedSessionsChanged = (
  previous: unknown[] | null | undefined,
  next: unknown[] | null | undefined,
) => {
  const previousKeys = (previous ?? []).map(getSessionKey).sort();
  const nextKeys = (next ?? []).map(getSessionKey).sort();

  return JSON.stringify(previousKeys) !== JSON.stringify(nextKeys);
};

const formatDuration = (hoursValue: number) => {
  const totalMinutes = Math.max(0, Math.round(hoursValue * 60));

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${minutes}m`;
};

const RECENT_ACTION_LIMIT = 8;

export function appendRecentGameActionSummary(
  previousSummary: string | null | undefined,
  currentSummary: string,
) {
  const previous = normalizeText(previousSummary)
    .replace(/Logged ([^•]+) play session/g, "Logged $1")
    .replace(/Playtime Decreased by ([^•]+)/g, "Deducted $1");

  if (currentSummary === "Game Cleared") {
    return currentSummary;
  }

  if (
    !previous ||
    previous === "Added to My Collection" ||
    previous === "Game Updated"
  ) {
    return currentSummary;
  }

  if (!currentSummary || currentSummary === previous) {
    return previous;
  }

  return [...previous.split(" • "), currentSummary]
    .slice(-RECENT_ACTION_LIMIT)
    .join(" • ");
}

export function getRecentGameActionSummary(
  previous: RecentActionTrackedGame | null | undefined,
  next: RecentActionTrackedGame,
  options?: {
    defaultSummary?: string;
  },
) {
  const defaultSummary = options?.defaultSummary ?? "Game Updated";

  const hasAnyPrevious = Boolean(
    previous &&
    (normalizeText(previous.status) ||
      normalizeNumber(previous.my_rating) !== null ||
      normalizeNumber(previous.progress) !== null ||
      normalizeNumber(previous.playtime) !== null ||
      normalizeText(previous.review?.text) ||
      (previous.favorite ?? false) ||
      (previous.notInterested ?? false) ||
      (previous.playedSessions?.length ?? 0) > 0 ||
      (previous.saveUploads?.length ?? 0) > 0),
  );

  if (!hasAnyPrevious) {
    return "Added to My Collection";
  }

  const prev = previous!;
  const changes: string[] = [];

  const previousHasTrackedData = Boolean(
    normalizeNumber(prev.my_rating) !== null ||
    (normalizeNumber(prev.progress) ?? 0) > 0 ||
    (normalizeNumber(prev.playtime) ?? 0) > 0 ||
    normalizeText(prev.review?.text) ||
    normalizeText(prev.review?.sticker) ||
    (prev.favorite ?? false) ||
    (prev.notInterested ?? false) ||
    (prev.playedSessions?.length ?? 0) > 0 ||
    normalizeText(prev.status) !== "Want To Play",
  );

  const nextIsCleared =
    normalizeNumber(next.my_rating) === null &&
    (normalizeNumber(next.progress) ?? 0) === 0 &&
    (normalizeNumber(next.playtime) ?? 0) === 0 &&
    !normalizeText(next.review?.text) &&
    !normalizeText(next.review?.sticker) &&
    !(next.favorite ?? false) &&
    !(next.notInterested ?? false) &&
    (next.playedSessions?.length ?? 0) === 0 &&
    normalizeText(next.status) === "Want To Play";

  if (
    previousHasTrackedData &&
    nextIsCleared &&
    !(next.notInterested ?? false)
  ) {
    return "Game Cleared";
  }
  // Favorites
  if ((prev.favorite ?? false) !== (next.favorite ?? false)) {
    changes.push(
      next.favorite ? "Added to Favorites" : "Removed from Favorites",
    );
  }

  // Not interested
  if ((prev.notInterested ?? false) !== (next.notInterested ?? false)) {
    changes.push(
      next.notInterested
        ? "Marked as Not Interested"
        : "Removed from Not Interested",
    );
  }

  // Status
  const previousStatus = normalizeText(prev.status);
  const nextStatus = normalizeText(next.status);

  if (previousStatus !== nextStatus && nextStatus) {
    changes.push(`Status Changed to ${nextStatus}`);
  }

  // Notes
  const previousNotes = normalizeText(prev.review?.text);
  const nextNotes = normalizeText(next.review?.text);

  if (previousNotes !== nextNotes) {
    changes.push(nextNotes ? "Review Edited" : "Review Removed");
  }

  // Sticker
  const previousSticker = normalizeText(prev.review?.sticker);
  const nextSticker = normalizeText(next.review?.sticker);

  if (previousSticker !== nextSticker) {
    if (!previousSticker && nextSticker) {
      changes.push("Sticker Added");
    } else if (previousSticker && !nextSticker) {
      changes.push("Sticker Removed");
    } else {
      changes.push("Sticker Changed");
    }
  }

  // Progress
  const previousProgress = normalizeNumber(prev.progress);
  const nextProgress = normalizeNumber(next.progress);

  if (previousProgress !== nextProgress && nextProgress !== null) {
    if (previousProgress === null) {
      changes.push(`Progress Set to ${nextProgress}%`);
    } else {
      changes.push(
        nextProgress > previousProgress
          ? `Progress Increased to ${nextProgress}%`
          : `Progress Decreased to ${nextProgress}%`,
      );
    }
  }

  // Rating
  const previousRating = normalizeNumber(prev.my_rating);
  const nextRating = normalizeNumber(next.my_rating);

  if (previousRating !== nextRating) {
    // Clearing the rating is part of marking the game as Not Interested,
    // so don't report it as a separate action.
    if (nextRating === null) {
      if (!next.notInterested) {
        changes.push("Rating Cleared");
      }
    } else {
      changes.push(
        previousRating === null
          ? `Rated the Game ${nextRating}`
          : `Rating Changed to ${nextRating}`,
      );
    }
  }

  // Playtime
  const previousPlaytime = normalizeNumber(prev.playtime);
  const nextPlaytime = normalizeNumber(next.playtime);

  if (previousPlaytime !== nextPlaytime && nextPlaytime !== null) {
    const diff = Math.abs(nextPlaytime - (previousPlaytime ?? 0));

    const formatted = formatDuration(diff);

    changes.push(
      nextPlaytime > (previousPlaytime ?? 0)
        ? `Logged ${formatted}`
        : `Deducted ${formatted}`,
    );
  }

  // Save uploads
  const previousSaveUploads = prev.saveUploads?.length ?? 0;
  const nextSaveUploads = next.saveUploads?.length ?? 0;

  if (previousSaveUploads !== nextSaveUploads) {
    changes.push(
      nextSaveUploads > previousSaveUploads
        ? "Save Backup Uploaded"
        : "Save Backup Removed",
    );
  }

  // Played sessions are already represented by the playtime message when
  // playtime changes, so only show this separately for session-only edits.
  if (
    playedSessionsChanged(prev.playedSessions, next.playedSessions) &&
    previousPlaytime === nextPlaytime
  ) {
    changes.push("Play Sessions Updated");
  }

  if (changes.length === 0) {
    return defaultSummary;
  }

  if (changes.length === 1) {
    return changes[0];
  }

  return changes.join(" • ");
}

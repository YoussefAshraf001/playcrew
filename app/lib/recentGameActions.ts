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
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return value;
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

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
      normalizeText(previous.notes) ||
      (previous.favorite ?? false) ||
      (previous.saveUploads?.length ?? 0) > 0),
  );

  if (!hasAnyPrevious) {
    return "Added to My Collection";
  }

  const prev = previous!;
  const changes: string[] = [];

  // Favorites
  if ((prev.favorite ?? false) !== (next.favorite ?? false)) {
    changes.push(
      next.favorite ? "Added to Favorites" : "Removed from Favorites",
    );
  }

  // Status
  const previousStatus = normalizeText(prev.status);
  const nextStatus = normalizeText(next.status);

  if (previousStatus !== nextStatus && nextStatus) {
    changes.push(`Status Changed to ${nextStatus}`);
  }

  // Notes
  const previousNotes = normalizeText(prev.notes);
  const nextNotes = normalizeText(next.notes);

  if (previousNotes !== nextNotes) {
    changes.push(nextNotes ? "Review Edited" : "Review Removed");
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
    if (nextRating === null) {
      changes.push("Rating Cleared");
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
        ? `Logged ${formatted} play session`
        : `Playtime Decreased by ${formatted}`,
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

  if (changes.length === 0) {
    return defaultSummary;
  }

  if (changes.length === 1) {
    return changes[0];
  }

  return changes.join(" • ");
}

// export interface RecentActionTrackedGame {
//   name?: string;
//   favorite?: boolean;
//   status?: string;
//   progress?: number | null;
//   my_rating?: number | null;
//   notes?: string | null;
//   playtime?: number | null;
//   saveUploads?: Array<{ id?: string }> | null;
// }

// const normalizeNumber = (value: unknown) => {
//   if (typeof value !== "number" || Number.isNaN(value)) {
//     return null;
//   }

//   return value;
// };

// const normalizeText = (value: unknown) =>
//   typeof value === "string" ? value.trim() : "";

// const formatDuration = (hoursValue: number) => {
//   const totalMinutes = Math.max(0, Math.round(hoursValue * 60));

//   const hours = Math.floor(totalMinutes / 60);
//   const minutes = totalMinutes % 60;

//   if (hours && minutes) {
//     return `${hours}h ${minutes}m`;
//   }

//   if (hours) {
//     return `${hours}h`;
//   }

//   return `${minutes}m`;
// };

// export function getRecentGameActionSummary(
//   previous: RecentActionTrackedGame | null | undefined,
//   next: RecentActionTrackedGame,
//   options?: {
//     defaultSummary?: string;
//   },
// ) {
//   const defaultSummary = options?.defaultSummary ?? "Game Updated";

//   const hasAnyPrevious = Boolean(
//     previous &&
//     (normalizeText(previous.status) ||
//       normalizeNumber(previous.my_rating) !== null ||
//       normalizeNumber(previous.progress) !== null ||
//       normalizeNumber(previous.playtime) !== null ||
//       normalizeText(previous.notes) ||
//       (previous.favorite ?? false) ||
//       (previous.saveUploads?.length ?? 0) > 0),
//   );

//   if (!hasAnyPrevious) {
//     return "Added to My Collection";
//   }

//   // Safe after guard above
//   const prev = previous!;

//   if ((prev.favorite ?? false) !== (next.favorite ?? false)) {
//     return next.favorite ? "Added to Favorites" : "Removed from Favorites";
//   }

//   const previousStatus = normalizeText(prev.status);

//   const nextStatus = normalizeText(next.status);

//   if (previousStatus !== nextStatus && nextStatus) {
//     return `Status Changed to ${nextStatus}`;
//   }

//   const previousProgress = normalizeNumber(prev.progress);

//   const nextProgress = normalizeNumber(next.progress);

//   if (previousProgress !== nextProgress && nextProgress !== null) {
//     if (previousProgress === null) {
//       return `Progress Set to ${nextProgress}%`;
//     }

//     return nextProgress > previousProgress
//       ? `Progress Increased to ${nextProgress}%`
//       : `Progress Decreased to ${nextProgress}%`;
//   }

//   const previousRating = normalizeNumber(prev.my_rating);

//   const nextRating = normalizeNumber(next.my_rating);

//   if (previousRating !== nextRating) {
//     if (nextRating === null) {
//       return "Rating Cleared";
//     }

//     return previousRating === null
//       ? `Rated the Game ${nextRating}`
//       : `Rating Changed to ${nextRating}`;
//   }

//   const previousNotes = normalizeText(prev.notes);

//   const nextNotes = normalizeText(next.notes);

//   if (previousNotes !== nextNotes) {
//     return nextNotes ? "Review Edited" : "Review Removed";
//   }

//   const previousPlaytime = normalizeNumber(prev.playtime);

//   const nextPlaytime = normalizeNumber(next.playtime);

//   if (previousPlaytime !== nextPlaytime && nextPlaytime !== null) {
//     const diff = Math.abs(nextPlaytime - (previousPlaytime ?? 0));

//     const formatted = formatDuration(diff);

//     return nextPlaytime > (previousPlaytime ?? 0)
//       ? `Logged ${formatted} play session`
//       : `Playtime Decreased by ${formatted}`;
//   }

//   const previousSaveUploads = prev.saveUploads?.length ?? 0;

//   const nextSaveUploads = next.saveUploads?.length ?? 0;

//   if (previousSaveUploads !== nextSaveUploads) {
//     return nextSaveUploads > previousSaveUploads
//       ? "Save Backup Uploaded"
//       : "Save Backup Removed";
//   }

//   return defaultSummary;
// }

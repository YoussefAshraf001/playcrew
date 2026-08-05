import { TrackedGame } from "@/app/types/trackedGame";

export type SortBy =
  | "name"
  | "date"
  | "tier"
  | "release"
  | "playtime"
  | "priority"
  | "progress";

export type SortOrder = "asc" | "desc";

export type ReleaseFilter = "All" | "Released" | "Unreleased";

export const normalizeGameName = (str: string) =>
  str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const getReleaseTime = (value: unknown): number => {
  if (!value) return Infinity;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? Infinity : value.getTime();
  }

  if (typeof value === "object" && value !== null && "seconds" in value) {
    return (value as { seconds: number }).seconds * 1000;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? Infinity : date.getTime();
  }

  return Infinity;
};

export const filterGames = ({
  allGames,
  gamesByStatus,
  selectedStatus,
  showFavoritesOnly,
  includeOnlineGames,
  includeUnreleasedGames,
  releaseFilter,
  searchQuery,
}: {
  allGames: TrackedGame[];
  gamesByStatus: Record<string, TrackedGame[]>;
  selectedStatus: string;
  showFavoritesOnly: boolean;
  includeOnlineGames: boolean;
  includeUnreleasedGames: boolean;
  releaseFilter: ReleaseFilter;
  searchQuery: string;
}) => {
  let list = showFavoritesOnly
    ? allGames.filter((g) => g.favorite)
    : selectedStatus === "All"
      ? gamesByStatus.All
      : gamesByStatus[selectedStatus] || [];

  list = [...list];

  if (!includeOnlineGames && selectedStatus === "All") {
    list = list.filter((g) => g.status !== "Online");
  }

  if (searchQuery) {
    const normalizedQuery = normalizeGameName(searchQuery);
    list = list.filter(
      (g) => g.name && normalizeGameName(g.name).includes(normalizedQuery),
    );
  }

  if (releaseFilter !== "All") {
    const now = Date.now();

    list = list.filter((g) => {
      const releaseTime = getReleaseTime(g.igdb?.releaseDate);

      if (releaseTime === Infinity) {
        return releaseFilter === "Unreleased";
      }

      const isReleased = releaseTime <= now;

      return releaseFilter === "Released" ? isReleased : !isReleased;
    });
  }

  if (selectedStatus === "All" && !includeUnreleasedGames) {
    const now = Date.now();

    list = list.filter((g) => {
      const releaseTime = getReleaseTime(g.igdb?.releaseDate);

      if (releaseTime === Infinity) return false;

      return releaseTime <= now;
    });
  }

  return list;
};

export const sortGames = ({
  games,
  sortBy,
  sortOrder,
}: {
  games: TrackedGame[];
  sortBy: SortBy;
  sortOrder: SortOrder;
}) => {
  return [...games].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return sortOrder === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      case "tier": {
        const aRating =
          typeof a.my_rating === "number" && Number.isFinite(a.my_rating)
            ? a.my_rating
            : Number.NEGATIVE_INFINITY;
        const bRating =
          typeof b.my_rating === "number" && Number.isFinite(b.my_rating)
            ? b.my_rating
            : Number.NEGATIVE_INFINITY;
        return sortOrder === "asc" ? aRating - bRating : bRating - aRating;
      }
      case "playtime":
        return sortOrder === "asc"
          ? (a.playtime ?? 0) - (b.playtime ?? 0)
          : (b.playtime ?? 0) - (a.playtime ?? 0);
      case "progress":
        return sortOrder === "asc"
          ? (a.progress ?? 0) - (b.progress ?? 0)
          : (b.progress ?? 0) - (a.progress ?? 0);
      case "priority":
        return sortOrder === "asc"
          ? (a.wantToPlayOrder ?? Number.MAX_SAFE_INTEGER) -
              (b.wantToPlayOrder ?? Number.MAX_SAFE_INTEGER)
          : (b.wantToPlayOrder ?? Number.MAX_SAFE_INTEGER) -
              (a.wantToPlayOrder ?? Number.MAX_SAFE_INTEGER);
      case "release": {
        const aVal = getReleaseTime(a.igdb?.releaseDate);
        const bVal = getReleaseTime(b.igdb?.releaseDate);
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      case "date":
      default: {
        const aVal = a.lastUpdated?.toMillis?.() ?? 0;
        const bVal = b.lastUpdated?.toMillis?.() ?? 0;
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
    }
  });
};

export const getStatusCounts = (allGames: TrackedGame[]) => ({
  completedCount: allGames.filter((g) => g.status === "Completed").length,
  onHoldCount: allGames.filter((g) => g.status === "On Hold").length,
  playingCount: allGames.filter((g) => g.status === "Playing").length,
  droppedCount: allGames.filter((g) => g.status === "Dropped").length,
  notInterestedCount: allGames.filter(
    (g) => g.status === "Not Interested" || g.notInterested,
  ).length,
  onlineCount: allGames.filter((g) => g.status === "Online").length,
  wantCount: allGames.filter((g) => g.status === "Want To Play").length,
});

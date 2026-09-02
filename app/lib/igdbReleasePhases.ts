import {
  inferReleaseDatePrecision,
  parseReleaseDate,
} from "@/app/lib/releaseDates";

export type IgdbReleaseDateKind =
  | "early-access"
  | "full-release"
  | "unknown";

export type IgdbReleaseEntry = {
  date?: number | null;
  human?: string | null;
  status?: { name?: string | null } | null;
  platform?: { name?: string | null } | null;
  release_region?: { region?: string | null } | null;
};

const normalizeStatus = (value?: string | null) =>
  value?.trim().toLowerCase().replace(/[_-]+/g, " ") ?? "";

const isEarlyAccessStatus = (value?: string | null) =>
  normalizeStatus(value).includes("early access");

const isFullReleaseStatus = (value?: string | null) => {
  const status = normalizeStatus(value);
  return (
    status.includes("full release") ||
    status === "released" ||
    status === "release"
  );
};

export const resolveIgdbReleasePhases = (
  entries: IgdbReleaseEntry[],
  fallbackDate?: number | null,
) => {
  const datedEntries = entries
    .filter(
      (entry): entry is IgdbReleaseEntry & { date: number } =>
        typeof entry.date === "number" && Number.isFinite(entry.date),
    )
    .sort((a, b) => a.date - b.date);

  const earlyAccessEntry = datedEntries.find((entry) =>
    isEarlyAccessStatus(entry.status?.name),
  );
  const fullReleaseEntry = datedEntries.find((entry) =>
    isFullReleaseStatus(entry.status?.name),
  );
  const fallbackEntry = datedEntries.find(
    (entry) => !isEarlyAccessStatus(entry.status?.name),
  ) ?? datedEntries[0];

  const earlyAccessDate = earlyAccessEntry?.date ?? null;
  const fullReleaseDate = fullReleaseEntry?.date ?? null;
  const primaryDate =
    fullReleaseDate ?? earlyAccessDate ?? fallbackEntry?.date ?? fallbackDate ?? null;
  const releaseDateKind: IgdbReleaseDateKind | null = fullReleaseDate
    ? "full-release"
    : earlyAccessDate
      ? "early-access"
      : primaryDate
        ? "unknown"
        : null;

  const primaryEntry =
    releaseDateKind === "full-release"
      ? fullReleaseEntry
      : releaseDateKind === "early-access"
        ? earlyAccessEntry
        : fallbackEntry;

  return {
    earlyAccessDate,
    earlyAccessDatePrecision: earlyAccessEntry
      ? inferReleaseDatePrecision(earlyAccessEntry.human)
      : null,
    fullReleaseDate,
    fullReleaseDatePrecision: fullReleaseEntry
      ? inferReleaseDatePrecision(fullReleaseEntry.human)
      : null,
    releaseDate: primaryDate,
    releaseDateKind,
    releaseDateHuman: primaryEntry?.human ?? null,
  };
};

export type AutomaticReleaseState =
  | "upcoming-early-access"
  | "early-access"
  | "upcoming-full-release"
  | "released"
  | "tba";

export const getAutomaticReleaseState = (
  earlyAccessValue: unknown,
  fullReleaseValue: unknown,
  primaryReleaseValue?: unknown,
  now = Date.now(),
): AutomaticReleaseState => {
  const earlyAccess = parseReleaseDate(earlyAccessValue)?.getTime() ?? null;
  const fullRelease = parseReleaseDate(fullReleaseValue)?.getTime() ?? null;
  const primary = parseReleaseDate(primaryReleaseValue)?.getTime() ?? null;

  if (fullRelease !== null && fullRelease <= now) return "released";
  if (earlyAccess !== null && earlyAccess <= now) return "early-access";
  if (earlyAccess !== null && earlyAccess > now) {
    return "upcoming-early-access";
  }
  if (fullRelease !== null && fullRelease > now) {
    return "upcoming-full-release";
  }
  if (primary !== null) {
    return primary <= now ? "released" : "upcoming-full-release";
  }
  return "tba";
};

export const isAutomaticallyInEarlyAccess = (
  earlyAccessValue: unknown,
  fullReleaseValue: unknown,
  now = Date.now(),
) =>
  getAutomaticReleaseState(
    earlyAccessValue,
    fullReleaseValue,
    undefined,
    now,
  ) === "early-access";

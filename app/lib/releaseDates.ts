export type ReleaseDatePrecision = "year" | "quarter" | "month" | "day";

export const parseReleaseDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }

  if (typeof value === "number") {
    const parsed = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export const inferReleaseDatePrecision = (
  human?: string | null,
): ReleaseDatePrecision => {
  if (!human) return "day";

  const value = human.trim();
  if (/^\d{4}$/.test(value)) return "year";
  if (/^Q[1-4]\s+\d{4}$/i.test(value)) return "quarter";
  if (/^\d{4}[-/.](?:0?[1-9]|1[0-2])$/.test(value)) return "month";
  if (/^(?:0?[1-9]|1[0-2])[-/.]\d{4}$/.test(value)) return "month";
  if (/^[A-Za-z]+\s+\d{4}$/.test(value)) return "month";
  return "day";
};

export const isEstimatedYearOnlyDate = (date: Date) => {
  const now = new Date();
  return (
    date.getTime() > now.getTime() &&
    date.getMonth() === 11 &&
    date.getDate() === 31
  );
};

const isEstimatedQuarterOnlyDate = (date: Date) => {
  const now = new Date();
  if (date.getTime() <= now.getTime()) return false;

  const month = date.getMonth();
  const day = date.getDate();
  const lastDayOfMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();

  return month !== 11 && [2, 5, 8].includes(month) && day === lastDayOfMonth;
};

const resolveReleasePrecision = (
  date: Date,
  precision?: ReleaseDatePrecision | null,
): ReleaseDatePrecision => {
  if (precision) return precision;
  if (isEstimatedYearOnlyDate(date)) return "year";
  if (isEstimatedQuarterOnlyDate(date)) return "quarter";
  return "day";
};

export const hasConfirmedReleaseDay = (
  value: unknown,
  precision?: ReleaseDatePrecision | null,
) => {
  const date = parseReleaseDate(value);
  if (!date) return false;
  return resolveReleasePrecision(date, precision) === "day";
};

const getQuarter = (date: Date) => Math.floor(date.getUTCMonth() / 3) + 1;

export const formatReleaseDate = (
  value: unknown,
  precision?: ReleaseDatePrecision | null,
  locale = "en-US",
): string => {
  const date = parseReleaseDate(value);
  if (!date) return "TBA";

  const resolvedPrecision = resolveReleasePrecision(date, precision);

  if (resolvedPrecision === "year") {
    return date.toLocaleDateString(locale, {
      year: "numeric",
      timeZone: "UTC",
    });
  }

  if (resolvedPrecision === "quarter") {
    return `Q${getQuarter(date)} ${date.getUTCFullYear()}`;
  }

  if (resolvedPrecision === "month") {
    return date.toLocaleDateString(locale, {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatReleaseChangeMessage = ({
  gameName,
  previousValue,
  nextValue,
  previousPrecision,
  nextPrecision,
}: {
  gameName: string;
  previousValue: unknown;
  nextValue: unknown;
  previousPrecision?: ReleaseDatePrecision | null;
  nextPrecision?: ReleaseDatePrecision | null;
}): string | null => {
  const previous = parseReleaseDate(previousValue);
  const next = parseReleaseDate(nextValue);

  if (!next) {
    return previous ? `${gameName}'s release date is now TBA.` : null;
  }

  const nextLabel = formatReleaseDate(next, nextPrecision);
  const nextHasExactDay = hasConfirmedReleaseDay(next, nextPrecision);

  if (!previous) {
    return nextHasExactDay
      ? `${gameName} got updated and is releasing on ${nextLabel}.`
      : `${gameName} got a release window of ${nextLabel}.`;
  }

  const previousHasExactDay = hasConfirmedReleaseDay(
    previous,
    previousPrecision,
  );
  const sameDate = previous.getTime() === next.getTime();

  if (!previousHasExactDay && nextHasExactDay) {
    return `${gameName} got updated and is releasing on ${nextLabel}.`;
  }

  if (sameDate) {
    if (previousPrecision !== nextPrecision && !nextHasExactDay) {
      return `${gameName} got a release window of ${nextLabel}.`;
    }
    return null;
  }

  const previousLabel = formatReleaseDate(previous, previousPrecision);

  if (!nextHasExactDay) {
    return `${gameName}'s release window changed from ${previousLabel} to ${nextLabel}.`;
  }

  return next.getTime() < previous.getTime()
    ? `${gameName}'s release date moved up from ${previousLabel} to ${nextLabel}.`
    : `${gameName}'s release date moved back from ${previousLabel} to ${nextLabel}.`;
};

export type ReleaseDatePrecision = "year" | "month" | "day";

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

const isEstimatedYearOnlyDate = (date: Date) => {
  const now = new Date();
  return (
    date.getTime() > now.getTime() &&
    date.getMonth() === 11 &&
    date.getDate() === 31
  );
};

export const formatReleaseDate = (
  value: unknown,
  _precision?: ReleaseDatePrecision | null,
  locale = "en-US",
): string => {
  const date = parseReleaseDate(value);
  if (!date) return "TBA";

  if (isEstimatedYearOnlyDate(date)) {
    return date.toLocaleDateString(locale, { year: "numeric" });
  }

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

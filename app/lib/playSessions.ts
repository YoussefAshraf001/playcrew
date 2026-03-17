import { PlaySession } from "../types/trackedGame";

const roundDurationHours = (value: number) =>
  Math.round(Math.max(0, value) * 100) / 100;

export const normalizeSessionDate = (value: any) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const normalizePlaySessions = (
  sessions?: PlaySession[] | null,
): PlaySession[] => {
  if (!Array.isArray(sessions)) return [];

  return sessions
    .map((session) => ({
      playedAt: normalizeSessionDate(session?.playedAt) ?? new Date(),
      durationHours: roundDurationHours(Number(session?.durationHours) || 0),
    }))
    .filter((session) => session.durationHours > 0)
    .sort((a, b) => {
      return (b.playedAt?.getTime?.() ?? 0) - (a.playedAt?.getTime?.() ?? 0);
    });
};

export const appendPlaySession = (
  previousSessions: PlaySession[] | null | undefined,
  previousPlaytime: number | null | undefined,
  nextPlaytime: number | null | undefined,
  playedAt: Date = new Date(),
): PlaySession[] => {
  const sessions = normalizePlaySessions(previousSessions);
  const prev = Number(previousPlaytime) || 0;
  const next = Number(nextPlaytime) || 0;
  const diff = roundDurationHours(next - prev);

  if (diff <= 0) return sessions;

  return [
    {
      playedAt,
      durationHours: diff,
    },
    ...sessions,
  ];
};

export const formatSessionDuration = (durationHours: number) => {
  const totalMinutes = Math.max(0, Math.round((durationHours || 0) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
};

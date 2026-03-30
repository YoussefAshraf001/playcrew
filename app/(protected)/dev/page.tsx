"use client";

import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";

import { useGames } from "@/app/context/GameContext";
import { useUser } from "@/app/context/UserContext";
import { db } from "@/app/lib/firebase";
import { formatReleaseDate, parseReleaseDate } from "@/app/lib/releaseDates";

type DevGame = {
  id: string;
  name: string;
  igdb?: {
    cover?: string;
    releaseDate?: unknown;
    displayReleaseDate?: unknown;
  };
  status?: string;
};

const toRawDetails = (value: unknown) => {
  if (!value) return { kind: "missing", raw: "null" };

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    const ts = value as { seconds: number; nanoseconds?: number };
    return {
      kind: "timestamp",
      raw: `seconds=${ts.seconds}${typeof ts.nanoseconds === "number" ? `, nanos=${ts.nanoseconds}` : ""}`,
    };
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return {
      kind: "firestore-date",
      raw: date.toISOString(),
    };
  }

  if (value instanceof Date) {
    return { kind: "date", raw: value.toISOString() };
  }

  if (typeof value === "number") {
    return { kind: "number", raw: String(value) };
  }

  if (typeof value === "string") {
    return { kind: "string", raw: value };
  }

  return { kind: typeof value, raw: JSON.stringify(value) };
};

const isFutureDec31 = (date: Date | null) => {
  if (!date) return false;
  return (
    date.getTime() > Date.now() &&
    date.getMonth() === 11 &&
    date.getDate() === 31
  );
};

export default function DevReleaseDatesPage() {
  const { games, gamesLoading } = useGames();
  const { user } = useUser();
  const [wrongOnly, setWrongOnly] = useState(true);
  const [fixing, setFixing] = useState(false);

  const rows = useMemo(() => {
    return (games as DevGame[])
      .map((game) => {
        const rawValue = game.igdb?.releaseDate;
        const parsed = parseReleaseDate(rawValue);
        const raw = toRawDetails(rawValue);
        const display = formatReleaseDate(rawValue);
        const storedDisplay =
          typeof game.igdb?.displayReleaseDate === "string"
            ? game.igdb.displayReleaseDate
            : "";
        const isWrong = isFutureDec31(parsed) && storedDisplay !== display;

        return {
          id: game.id,
          name: game.name,
          status: game.status ?? "-",
          display,
          storedDisplay,
          parsed,
          parsedIso: parsed ? parsed.toISOString() : "-",
          rawKind: raw.kind,
          rawValue: raw.raw,
          isFutureDec31: isFutureDec31(parsed),
          isWrong,
        };
      })
      .filter((row) => row.parsed)
      .sort(
        (a, b) =>
          a.parsed!.getTime() - b.parsed!.getTime() ||
          a.name.localeCompare(b.name),
      );
  }, [games]);

  const futureDec31Rows = useMemo(
    () => rows.filter((row) => row.isFutureDec31),
    [rows],
  );

  const visibleRows = useMemo(
    () => (wrongOnly ? futureDec31Rows.filter((row) => row.isWrong) : rows),
    [futureDec31Rows, rows, wrongOnly],
  );

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { parsedIso: string; display: string; count: number; names: string[] }
    >();

    futureDec31Rows.forEach((row) => {
      const key = row.parsedIso;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.names.push(row.name);
        return;
      }
      map.set(key, {
        parsedIso: row.parsedIso,
        display: row.display,
        count: 1,
        names: [row.name],
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || a.parsedIso.localeCompare(b.parsedIso),
    );
  }, [futureDec31Rows]);

  const wrongRows = useMemo(
    () => futureDec31Rows.filter((row) => row.isWrong),
    [futureDec31Rows],
  );

  const fixWrongOnes = async () => {
    if (!user?.uid || !wrongRows.length || fixing) return;

    setFixing(true);
    try {
      const batch = writeBatch(db);

      wrongRows.forEach((row) => {
        const game = (games as DevGame[]).find((entry) => entry.id === row.id);
        if (!game) return;

        batch.update(doc(db, "users", user.uid, "games_igdb", row.id), {
          igdb: {
            ...(game.igdb ?? {}),
            displayReleaseDate: row.display,
          },
          lastUpdated: serverTimestamp(),
        });
      });

      await batch.commit();
    } finally {
      setFixing(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>PlayCrew - Dev Release Dates</title>
      </Helmet>

      <main className="min-h-screen bg-black px-4 pb-10 pt-24 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/75">
              Dev
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Release Date Audit</h1>
            <p className="mt-2 text-sm text-white/60">
              Compares the UI label against the raw Firebase release date and the stored display label.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setWrongOnly((value) => !value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  wrongOnly
                    ? "border-amber-300/40 bg-amber-400/12 text-amber-100"
                    : "border-white/15 bg-white/5 text-white/75"
                }`}
              >
                {wrongOnly ? "Showing Wrong Ones Only" : "Showing All Rows"}
              </button>
              <button
                type="button"
                onClick={() => void fixWrongOnes()}
                disabled={!wrongRows.length || fixing || !user?.uid}
                className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/18 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {fixing ? "Fixing..." : `Fix Wrong Ones (${wrongRows.length})`}
              </button>
              <span className="text-sm text-white/45">
                Writes `igdb.displayReleaseDate` for future fake Dec 31 rows.
              </span>
            </div>
          </header>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Future Dec 31 Groups</h2>
            <p className="mt-1 text-sm text-white/55">
              If these rows share the same ISO date, Firebase is storing the same exact day for them.
            </p>
            <div className="mt-4 space-y-3">
              {gamesLoading ? (
                <div className="text-sm text-white/60">Loading tracked games...</div>
              ) : grouped.length === 0 ? (
                <div className="text-sm text-white/60">No future Dec 31 entries found.</div>
              ) : (
                grouped.map((group) => (
                  <div key={group.parsedIso} className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="rounded-full bg-black/30 px-3 py-1 font-semibold text-amber-100">
                        {group.display}
                      </span>
                      <span className="text-white/70">{group.parsedIso}</span>
                      <span className="text-white/50">{group.count} game{group.count === 1 ? "" : "s"}</span>
                    </div>
                    <p className="mt-3 text-sm text-white/75">{group.names.join(", ")}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold">
                {wrongOnly ? "Wrong Rows Only" : "All Tracked Dates"}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/5 text-white/55">
                  <tr>
                    <th className="px-4 py-3 font-medium">Game</th>
                    <th className="px-4 py-3 font-medium">UI Display</th>
                    <th className="px-4 py-3 font-medium">Stored Display</th>
                    <th className="px-4 py-3 font-medium">Parsed ISO</th>
                    <th className="px-4 py-3 font-medium">Raw Type</th>
                    <th className="px-4 py-3 font-medium">Raw Firebase Value</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id} className="border-t border-white/10 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{row.name}</div>
                        <div className="mt-1 text-xs text-white/45">{row.status}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.isFutureDec31 ? "bg-amber-400/15 text-amber-100" : "bg-white/8 text-white/75"}`}>
                          {row.display}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.isWrong ? "bg-red-500/15 text-red-100" : "bg-emerald-500/12 text-emerald-100"}`}>
                          {row.storedDisplay || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white/70">{row.parsedIso}</td>
                      <td className="px-4 py-3 text-white/65">{row.rawKind}</td>
                      <td className="px-4 py-3 font-mono text-xs text-white/55">{row.rawValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!gamesLoading && visibleRows.length === 0 && (
                <div className="px-5 py-6 text-sm text-white/55">No rows match the current filter.</div>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

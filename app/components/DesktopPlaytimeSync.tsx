"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FiCheck, FiX } from "react-icons/fi";
import { doc, runTransaction, Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";

import { useGames } from "../context/GameContext";
import { useUser } from "../context/UserContext";
import { db } from "../lib/firebase";
import { normalizePlaySessions } from "../lib/playSessions";
import type { DesktopPlaytimeEvent } from "../lib/desktopImageStorage";

const normalizeName = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");

const formatDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ""}` : `${minutes}m`;
};

export default function DesktopPlaytimeSync() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { games, gamesLoading } = useGames();
  const [confirmation, setConfirmation] = useState<{
    name: string;
    cover: string;
    duration: string;
  } | null>(null);
  const readyRef = useRef({ user, userLoading, games, gamesLoading });
  const handledRef = useRef(new Set<string>());
  const queuedRef = useRef(new Set<string>());
  const waitingRef = useRef<DesktopPlaytimeEvent[]>([]);

  useEffect(() => {
    readyRef.current = { user, userLoading, games, gamesLoading };
  }, [games, gamesLoading, user, userLoading]);

  const handleEvent = useCallback(async (event: DesktopPlaytimeEvent) => {
    const key = event.eventId || `${event.gameId}:${event.gameName}:${event.elapsedSeconds}`;
    if (handledRef.current.has(key)) return;
    router.push("/games");

    const state = readyRef.current;
    if (state.userLoading || state.gamesLoading) {
      if (!queuedRef.current.has(key)) {
        queuedRef.current.add(key);
        waitingRef.current.push(event);
      }
      return;
    }
    queuedRef.current.delete(key);
    handledRef.current.add(key);

    if (!state.user) {
      toast.error(`Sign in to log ${formatDuration(event.elapsedSeconds)} for ${event.gameName}.`, { duration: 6000 });
      return;
    }

    const matches = state.games.filter((game) => normalizeName(game.name) === normalizeName(event.gameName));
    if (matches.length !== 1) {
      toast.error(
        matches.length > 1
          ? `More than one PlayCrew game matches ${event.gameName}; playtime was not changed.`
          : `${event.gameName} is not in your PlayCrew library; playtime was not changed.`,
        { duration: 6000 },
      );
      return;
    }

    const game = matches[0];
    const gameRef = doc(db, "users", state.user.uid, "games_igdb", game.id);
    const durationHours = Math.max(0.01, Math.round((event.elapsedSeconds / 3600) * 100) / 100);

    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(gameRef);
        if (!snapshot.exists()) throw new Error("The matched game no longer exists.");
        const current = snapshot.data();
        const previousPlaytime = Number(current.playtime) || 0;
        const nextPlaytime = Math.round((previousPlaytime + durationHours) * 100) / 100;
        const playedAt = new Date();
        const playedSessions = [
          { playedAt, durationHours },
          ...normalizePlaySessions(current.playedSessions),
        ];
        transaction.update(gameRef, {
          playtime: nextPlaytime,
          playedSessions,
          lastUpdated: Timestamp.fromDate(playedAt),
          recentActionSummary: `Played ${formatDuration(event.elapsedSeconds)} via Playnite`,
          recentActionSource: "user",
          playniteGameId: event.gameId || null,
        });
      });
      setConfirmation({
        name: game.name,
        cover: game.igdb?.cover || "/placeholder-game.jpg",
        duration: formatDuration(event.elapsedSeconds),
      });
    } catch (error) {
      console.error("Failed to log Playnite session", error);
      toast.error(`Could not log playtime for ${event.gameName}.`, { duration: 6000 });
    }
  }, [router]);

  useEffect(() => {
    if (userLoading || gamesLoading || waitingRef.current.length === 0) return;
    const waiting = waitingRef.current.splice(0);
    waiting.forEach((event) => void handleEvent(event));
  }, [gamesLoading, handleEvent, userLoading]);

  useEffect(() => {
    const desktop = window.playcrewDesktop;
    if (!desktop?.takePlaytimeEvent || !desktop.onPlaytimeLogged) return;
    const unsubscribe = desktop.onPlaytimeLogged((event) => void handleEvent(event));
    const consumePending = () => {
      void desktop.takePlaytimeEvent().then((event) => {
        if (event) void handleEvent(event);
      }).catch((error) => console.error("Could not read pending Playnite session", error));
    };
    consumePending();
    const poll = window.setInterval(consumePending, 1000);
    return () => {
      window.clearInterval(poll);
      unsubscribe();
    };
  }, [handleEvent]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {confirmation && (
        <motion.div
          className="fixed inset-0 z-[2147483100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setConfirmation(null)}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="playtime-confirmation-title"
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(event) => event.stopPropagation()}
            className="theme-panel-strong relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/15 p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.75)]"
          >
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/25 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Close playtime confirmation"
            >
              <FiX />
            </button>

            <div className="mx-auto w-36 overflow-hidden rounded-2xl border border-white/15 bg-black/30 shadow-2xl">
              {/* Desktop-local covers are resolved by the Electron preload. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={confirmation.cover}
                alt={`${confirmation.name} cover`}
                className="aspect-[3/4] w-full object-cover"
              />
            </div>

            <div className="theme-accent-soft-bg mx-auto mt-5 grid h-10 w-10 place-items-center rounded-full border">
              <FiCheck className="text-lg" />
            </div>
            <p className="theme-accent-text mt-3 text-[10px] font-black uppercase tracking-[0.24em]">
              Playtime logged
            </p>
            <h2 id="playtime-confirmation-title" className="theme-text mt-2 text-2xl font-black">
              {confirmation.name}
            </h2>
            <p className="theme-text-muted mt-2 text-sm">Session added to your PlayCrew library</p>
            <p className="theme-text mt-4 text-3xl font-black tabular-nums">{confirmation.duration}</p>

            <button
              type="button"
              onClick={() => setConfirmation(null)}
              className="theme-accent-bg mt-6 min-h-11 w-full rounded-xl px-5 text-sm font-black transition hover:brightness-110"
            >
              Done
            </button>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

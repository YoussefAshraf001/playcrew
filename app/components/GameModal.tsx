"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog } from "@headlessui/react";
import toast from "react-hot-toast";
import { FaHeart } from "react-icons/fa";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Game } from "../types/game";
import { useUser } from "@/app/context/UserContext";
import ScreenshotsCarousel from "./Screenshots";

import HLTBSection from "./game/HLTBSection";
import PlayerStatus from "./game/PlayerStatus";
import RatingsBreakdown from "./game/RatingsBreakdown";
import StoresList from "./game/StoresList";
import XPBadge from "./game/XPBadge";

interface GameModalProps {
  game: Game;
  onClose: () => void;
}

const statuses = ["Playing", "On Hold", "Dropped", "Completed"] as const;
type StatusType = (typeof statuses)[number] | null;

export default function GameModal({ game, onClose }: GameModalProps) {
  const { user } = useUser();
  const [isFavorited, setIsFavorited] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<StatusType>(null);
  const [loadingFavorite, setLoadingFavorite] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);

  const [hltbData, setHltbData] = useState({
    mainStory: 0,
    completionist: 0,
  });

  useEffect(() => {
    if (!user) return;

    const fetchUserTracked = async () => {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      const tracked = snap.data()?.trackedGames?.[String(game.id)];
      if (tracked) {
        setIsFavorited(!!tracked.favorite);
        setCurrentStatus(tracked.status || null);
      }
    };

    fetchUserTracked();
  }, [user, game.id]);

  useEffect(() => {
    const fetchHLTB = async () => {
      try {
        const res = await fetch(
          `/api/hlbt?game=${encodeURIComponent(game.slug)}`
        );
        const data = await res.json();
        setHltbData({
          mainStory: data.mainStory || 0,
          completionist: data.completionist || 0,
        });
      } catch {
        setHltbData({ mainStory: 0, completionist: 0 });
      }
    };

    fetchHLTB();
  }, [game.slug]);

  const updateTrackedGame = async (patch: Partial<any>) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const trackedGames = snap.data()?.trackedGames || {};
    const updated = {
      ...trackedGames,
      [String(game.id)]: { ...trackedGames[game.id], ...patch, id: game.id },
    };
    await updateDoc(userRef, { trackedGames: updated });
  };

  const handleFavorite = async () => {
    try {
      setLoadingFavorite(true);
      const newFav = !isFavorited;
      await updateTrackedGame({ favorite: newFav });
      setIsFavorited(newFav);
      toast.success(
        `${game.name} ${
          newFav ? "added to favorites" : "removed from favorites"
        }`
      );
    } catch {
      toast.error("Failed to update favorite.");
    } finally {
      setLoadingFavorite(false);
    }
  };

  const handleStatus = async (status: StatusType) => {
    try {
      setLoadingStatus(status);
      await updateTrackedGame({ status });
      setCurrentStatus(status);
      toast.success(`${game.name} marked as ${status}`);
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setLoadingStatus(null);
    }
  };

  return (
    <AnimatePresence>
      <Dialog
        as={motion.div}
        open={true}
        onClose={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-lg"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          className="relative w-11/12 max-w-5xl max-h-[90vh] bg-zinc-900/95 rounded-2xl overflow-hidden shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white text-2xl font-bold hover:text-red-400 z-20"
          >
            &times;
          </button>

          <div className="relative h-44 md:h-56 w-full">
            <img
              src={game.background_image || "/placeholder-game.jpg"}
              alt={game.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
            <div className="absolute left-6 bottom-4 right-6">
              <h2 className="text-3xl font-bold text-white">{game.name}</h2>
            </div>
          </div>

          <div className="p-5 overflow-y-auto max-h-[calc(90vh-14rem)] text-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 flex flex-col gap-4">
                <XPBadge hltbData={hltbData} />
                <HLTBSection hltbData={hltbData} />
                {game.added_by_status && (
                  <PlayerStatus data={game.added_by_status} />
                )}
              </div>

              <div className="md:col-span-2 flex flex-col gap-4">
                {game.ratings?.length ? (
                  <RatingsBreakdown ratings={game.ratings} />
                ) : null}
                <StoresList game={game} />
                <ScreenshotsCarousel
                  screenshots={game.short_screenshots || []}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </Dialog>
    </AnimatePresence>
  );
}

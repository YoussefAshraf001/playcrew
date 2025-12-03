"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  FaHeart,
  FaPlaystation,
  FaXbox,
  FaApple,
  FaAndroid,
  FaSteam,
  FaStar,
  FaPause,
  FaPlay,
  FaCrown,
  FaLinux,
} from "react-icons/fa";
import { BsNintendoSwitch } from "react-icons/bs";
import { IoLogoGameControllerA } from "react-icons/io";
import { GiMouthWatering } from "react-icons/gi";
import { MdBookmarkRemove } from "react-icons/md";
import { TbBucketDroplet } from "react-icons/tb";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { IoBanOutline } from "react-icons/io5";

import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import ScreenshotsCarousel from "@/app/components/Screenshots";
import GameTrackingModal from "@/app/components/GameTrackingModal";
import ConfirmModal from "@/app/components/ConfirmModal";
import LoadingSpinner from "@/app/components/LoadingSpinner";

const statuses = [
  { label: "Playing", icon: <FaPlay />, color: "bg-blue-500" },
  { label: "On Hold", icon: <FaPause />, color: "bg-yellow-500" },
  {
    label: "Dropped",
    icon: <TbBucketDroplet size={15} />,
    color: "bg-red-500",
  },
  {
    label: "Completed",
    icon: <FaCrown size={20} />,
    color: "bg-green-500",
  },
  {
    label: "Not Interested",
    icon: <IoBanOutline size={20} />,
    color: "bg-green-500",
  },
  {
    label: "Want to Play",
    icon: <GiMouthWatering size={20} />,
    color: "bg-green-500",
  },
];

type StatusType = string | null;

export default function GamePage() {
  const { id } = useParams();
  const { user } = useUser();

  const [game, setGame] = useState<any>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<StatusType>(null);
  const [loadingFavorite, setLoadingFavorite] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [loadingGame, setLoadingGame] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);

  const [aboutOpen, setAboutOpen] = useState(false);

  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playtime, setPlaytime] = useState(0);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const requireLogin = () => {
    if (!user) {
      toast.error("You must be logged in to use this feature");
      return false;
    }
    return true;
  };

  // Fetch game data
  useEffect(() => {
    const fetchGame = async () => {
      setLoadingGame(true);
      try {
        const res = await fetch(
          `https://api.rawg.io/api/games/${id}?key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
        );
        const data = await res.json();

        const screenshotsRes = await fetch(
          `https://api.rawg.io/api/games/${id}/screenshots?key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
        );
        const screenshotsData = await screenshotsRes.json();

        setGame({ ...data, short_screenshots: screenshotsData.results });
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingGame(false);
      }
    };
    fetchGame();
  }, [id]);

  // Fetch user tracked data
  useEffect(() => {
    if (!user || !game) return;
    const fetchUserTracked = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      const trackedGames = snap.data()?.trackedGames || {};
      const tracked = trackedGames[String(game.id)] || trackedGames[game.id];
      if (tracked) {
        setIsFavorited(Boolean(tracked.favorite));
        setCurrentStatus(tracked.status || null);
        setNotes(tracked.notes || "");
        setRating(tracked.rating || 0);
        setProgress(tracked.progress || 0);
        setPlaytime(tracked.playtime || 0);
      }
    };
    fetchUserTracked();
  }, [user, game, currentStatus]);

  const updateTrackedGame = async (patch: Partial<any>) => {
    if (!user || !game) return;
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const trackedGames = snap.exists() ? snap.data().trackedGames || {} : {};

    const merged = {
      ...(trackedGames[String(game.id)] || {}),
      ...patch,
      id: game.id,
      name: game.name,
      background_image: game.background_image,
      my_rating: game.rating,
    };

    await updateDoc(ref, {
      trackedGames: { ...trackedGames, [String(game.id)]: merged },
    });

    return merged;
  };

  const handleFavoriteToggle = async () => {
    if (!game) return;
    if (!user) {
      toast.error(<>You must be logged to use this feature.</>);
      return;
    }
    try {
      setLoadingFavorite(true);
      const newFav = !isFavorited;
      const merged = await updateTrackedGame({
        favorite: newFav,
        status: currentStatus,
      });
      setIsFavorited(Boolean(merged.favorite));
      toast.success(
        `${game.name} ${
          newFav ? "added to favorites" : "removed from favorites"
        }`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update favorite.");
    } finally {
      setLoadingFavorite(false);
    }
  };

  const handleChangeStatus = async (status: string) => {
    if (!game) return;
    if (!user) {
      toast.error(<>You must be logged to use this feature.</>);
      return;
    }

    if (currentStatus?.trim().toLowerCase() === status.toLowerCase()) {
      toast.error(
        <>
          Game is already set as{" "}
          <span className={`text-red-600 pl-1`}>{currentStatus}</span>
        </>
      );

      return;
    }
    try {
      setLoadingStatus(status);
      const merged = await updateTrackedGame({
        status,
        favorite: isFavorited,
        lastUpdated: serverTimestamp(),
      });
      setCurrentStatus(merged.status?.trim() || null);
      toast.success(`${game.name} marked as ${status}`);
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setLoadingStatus(null);
    }
  };

  if (!game || loadingGame) return <LoadingSpinner />;

  // Normalize parent platforms
  const normalizeParentPlatforms = (
    platforms: { platform: { name: string } }[]
  ) => {
    const seen = new Set<string>();
    return platforms
      .map(({ platform }) => {
        let name = platform.name.toLowerCase();

        // Normalize Apple/iOS/macOS
        if (
          name.includes("ios") ||
          name.includes("apple") ||
          name.includes("mac")
        ) {
          name = "apple";
        }

        // Normalize PlayStation, Xbox, Nintendo
        if (name.includes("playstation")) name = "playstation";
        if (name.includes("xbox")) name = "xbox";
        if (name.includes("nintendo")) name = "nintendo";
        if (name.includes("pc")) name = "steam";
        return name;
      })
      .filter((name) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  };

  // Icon mapping
  const getPlatformIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case "steam":
        return <FaSteam />;
      case "playstation":
        return <FaPlaystation />;
      case "xbox":
        return <FaXbox />;
      case "nintendo":
        return <BsNintendoSwitch />;
      case "apple":
        return <FaApple />;
      case "android":
        return <FaAndroid />;
      case "linux":
        return <FaLinux />;
      default:
        return <IoLogoGameControllerA />;
    }
  };

  // Platform link
  const getPlatformLink = (platform: string, gameName: string) => {
    switch (platform.toLowerCase()) {
      case "steam":
        return `https://store.steampowered.com/search/?term=${encodeURIComponent(
          gameName
        )}`;
      case "playstation":
        return `https://store.playstation.com/en-us/search/${encodeURIComponent(
          gameName
        )}`;
      case "xbox":
        return `https://www.xbox.com/en-us/Search/Results?q=${encodeURIComponent(
          gameName
        )}`;
      case "nintendo":
        return `https://www.nintendo.com/search/?q=${encodeURIComponent(
          gameName
        )}`;
      case "apple":
        return `https://apps.apple.com/us/search?term=${encodeURIComponent(
          gameName
        )}`;
      default:
        return `https://www.google.com/search?q=${encodeURIComponent(
          gameName + " " + platform
        )}`;
    }
  };

  const truncate = (text: string, length = 300) => {
    if (!text) return "";
    return text.length > length ? text.slice(0, length) + "..." : text;
  };

  if (loadingGame) {
    return (
      <motion.div
        className="flex items-center justify-center min-h-screen bg-black text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
      </motion.div>
    );
  }

  return (
    <div className="relative min-h-screen text-white bg-transparent pt-15 lg:pt-8">
      {/* HERO BACKGROUND */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 z-0"
      >
        <img
          src={game.background_image}
          className="w-full h-full object-cover brightness-[0.45] blur-xl"
        />

        <div className="absolute inset-0 bg-linear-to-b from-black/20 to-black" />
      </motion.div>

      {/* MAIN CONTENT */}

      <motion.main
        className="relative flex flex-col lg:flex-row gap-12 z-10 p-6 md:p-12 max-w-[1800px] mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* Center content */}
        <div className="flex-1 flex flex-col gap-8 just">
          {/* Poster + Header */}
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            <motion.img
              src={game.background_image}
              className="absoulte w-56 md:w-72 h-80 md:h-96 object-cover rounded-2xl shadow-xl shrink-0"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            />

            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-4">
                <h1 className="text-5xl md:text-6xl font-extrabold drop-shadow-xl">
                  {game.name}
                </h1>
              </div>

              {/* Favorite */}
              <div className="flex justify-center lg:block">
                <button
                  onClick={handleFavoriteToggle}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-base border border-white/10 hover:bg-red-500 hover:scale-105 transition cursor-pointer ${
                    isFavorited ? "bg-red-600" : "bg-white/10"
                  }`}
                  disabled={loadingFavorite}
                >
                  {loadingFavorite ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <>
                      <FaHeart /> {isFavorited ? "Favorited" : "Favorite"}
                    </>
                  )}
                </button>
              </div>

              {/* Status Buttons */}
              <div className="flex flex-wrap gap-3">
                {statuses.map((s) => {
                  const isSelected =
                    currentStatus?.trim().toLowerCase() ===
                    s.label.toLowerCase();
                  return (
                    <button
                      key={s.label}
                      onClick={() => handleChangeStatus(s.label)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-base border border-white/10 transition cursor-pointer hover:scale-105 ${
                        isSelected ? s.color : "bg-white/10 hover:bg-white/20"
                      }`}
                    >
                      {loadingStatus === s.label ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : (
                        <>
                          {s.icon && s.icon}
                          <span>{s.label}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Notes & Delete */}
              <div className="flex gap-3 mt-2 justify-between">
                <button
                  onClick={() => {
                    if (!requireLogin()) return;
                    setNotesModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 transition font-semibold text-base cursor-pointer hover:scale-105"
                >
                  📝 Notes
                </button>

                <button
                  onClick={() => {
                    if (!requireLogin()) return;
                    setDeleteModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition font-semibold text-base cursor-pointer hover:scale-105"
                >
                  <MdBookmarkRemove size={20} /> Remove
                </button>
              </div>

              {/* About */}
              <div
                onClick={() => setAboutOpen(true)}
                className="bg-white/5 border border-white/10 p-6 rounded-2xl text-white/80 hover:text-white"
              >
                <h2 className="text-2xl font-bold mb-3">About</h2>

                <p className=" text-base leading-relaxed transition">
                  {game.description_raw ? (
                    truncate(game.description_raw, 400)
                  ) : (
                    <span>No Description found</span>
                  )}
                </p>

                {game.description_raw && (
                  <p
                    className="text-cyan-300 mt-2 text-sm cursor-pointer hover:underline"
                    onClick={() => setAboutOpen(true)}
                  >
                    Read more
                  </p>
                )}
              </div>

              <AnimatePresence>
                {aboutOpen && (
                  <>
                    {/* Backdrop */}
                    <motion.div
                      key="backdrop"
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-999"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      onClick={() => setAboutOpen(false)} // click outside to close
                    />

                    {/* Modal Content */}
                    <motion.div
                      key="modal"
                      className="fixed inset-x-0 top-1/2 -translate-y-1/2 mx-auto bg-white/10 border border-white/20 rounded-2xl p-6 max-w-3xl w-full z-1000 shadow-2xl"
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 100, opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 120,
                        damping: 16,
                      }}
                    >
                      <h2 className="text-3xl font-bold mb-4">About</h2>

                      <p className="text-white/80 text-base leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
                        {game.description_raw}
                      </p>

                      <button
                        onClick={() => setAboutOpen(false)}
                        className="absolute top-3 right-3 text-white/70 hover:text-white text-2xl"
                      >
                        ✕
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* Stats */}
              <div className="w-full flex flex-col sm:flex-row justify-center items-center gap-4">
                {/* Rating */}
                <div className="flex-1 sm:flex-none p-4 bg-white/5 rounded-lg border border-white/10 text-center">
                  <div className="text-sm opacity-70">Rating</div>
                  <div className="flex justify-center items-center gap-1 text-xl font-bold">
                    {game.rating} / 5 <FaStar className="text-amber-300" />
                  </div>
                </div>

                {/* Release */}
                <div className="flex-1 sm:flex-none p-4 bg-white/5 rounded-lg border border-white/10 text-center">
                  <div className="text-sm opacity-70">Release</div>
                  <div className="text-base font-semibold">{game.released}</div>
                </div>

                {/* Screenshots */}
                <div className="flex-1 sm:flex-none p-4 bg-white/5 rounded-lg border border-white/10 text-center">
                  <div className="text-sm opacity-70">Screenshots</div>
                  <div className="text-xl font-bold">
                    {game.short_screenshots?.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trailer */}
          <button
            onClick={() =>
              window.open(
                `https://www.youtube.com/results?search_query=${encodeURIComponent(
                  game.name + " official trailer"
                )}`,
                "_blank"
              )
            }
            className="px-6 py-3 bg-none border-2 border-cyan-400 hover:bg-cyan-400 duration-300 ease-in-out transition-all cursor-pointer rounded-lg font-bold"
          >
            Watch Trailer
          </button>

          {/* Screenshots */}
          <ScreenshotsCarousel screenshots={game.short_screenshots} />
        </div>

        {/* Right column: Stores & repacks */}
        <div className="w-full lg:w-80 shrink-0 space-y-6 lg:sticky lg:top-28">
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4">
            <h2 className="text-center text-lg font-bold mb-2">Stores</h2>

            {/* Divider */}
            <hr className="w-full border-zinc-700" />

            <div className="flex flex-col gap-2">
              <h3>Official</h3>
              {normalizeParentPlatforms(game.parent_platforms).map(
                (platform) => (
                  <a
                    key={platform}
                    href={getPlatformLink(platform, game.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 hover:scale-105 transition text-sm"
                  >
                    {getPlatformIcon(platform)}
                    <span className="capitalize">{platform}</span>
                  </a>
                )
              )}

              <h3 className="pt-2">Cracked</h3>

              {/* FitGirl */}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`https://fitgirl-repacks.site/${encodeURIComponent(
                  game.name
                    .toLowerCase() // Convert to lowercase
                    .replace(/\s+/g, "-") // Replace spaces with hyphens
                    .replace(/[^a-z0-9-]/g, "") // Remove any non-alphanumeric characters except hyphen
                )}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 hover:scale-105 transition text-sm"
              >
                <img
                  src="/logos/Fitgirl.jpg"
                  alt="FitGirl"
                  className="w-5 h-5 rounded-full"
                />
                <span>FitGirl Repacks</span>
              </a>

              {/* Dodi */}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`https://dodi-repacks.site/${encodeURIComponent(
                  game.name
                    .toLowerCase() // Convert to lowercase
                    .replace(/\s+/g, "-") // Replace spaces with hyphens
                    .replace(/[^a-z0-9-]/g, "") // Remove any non-alphanumeric characters except hyphen
                )}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:scale-105  hover:bg-white/20 transition text-sm"
              >
                <img
                  // src="/logos/DODI.jpg"
                  src={`https://www.google.com/s2/favicons?domain=dodi-repacks.site&sz=64`}
                  alt="Dodi"
                  className="w-5 h-5 rounded-full"
                />
                <span>Dodi Repacks</span>
              </a>

              {/* ⭐ SkidrowReloaded */}
              <a
                key="skidrow"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://www.skidrowreloaded.com/?s=${encodeURIComponent(
                  game.name
                )}`}
                className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/10 hover:scale-105 hover:bg-white/20 transition text-sm"
              >
                <img
                  // src="/logos/Skidrow.png"
                  src={`https://www.google.com/s2/favicons?domain=skidrowreloaded.com&sz=64`}
                  className="w-5 h-5 object-cover rounded-full"
                  alt="SkidrowReloaded"
                />
                <span>Skidrow Reloaded</span>
              </a>

              {/* GameDrive */}
              <a
                key="gamedrive"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://gamedrive.org/?s=${encodeURIComponent(
                  game.name
                )}`}
                className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/10 hover:scale-105 hover:bg-white/20 transition text-sm"
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=gamedrive.org&sz=64`}
                  className="w-5 h-5 rounded-full"
                />

                <span>GameDrive</span>
              </a>

              {/* Divider */}
              <hr className="mt-3 w-full border-zinc-700" />

              <h2 className="text-center text-lg font-bold mb-2">Mods</h2>
              <a
                key="nexus"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://www.nexusmods.com/games/${encodeURIComponent(
                  game.name
                    .toLowerCase() // Convert to lowercase
                    .replace(/\s+/g, "") // Remove spaces
                    .replace(/[^a-z0-9-]/g, "") // Remove any non-alphanumeric characters (except hyphen)
                )}`}
                className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/10 hover:scale-105 hover:bg-white/20 transition text-sm"
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=nexusmods.com/&sz=64`}
                  className="w-5 h-5 rounded-full"
                />

                <span>Nexus Mods</span>
              </a>
            </div>
          </div>
        </div>
      </motion.main>

      {/* Notes Modal */}
      <GameTrackingModal
        open={notesModalOpen}
        initialNotes={notes || ""}
        initialRating={rating || 0}
        initialProgress={progress || 0}
        initialPlaytime={playtime || 0}
        initialFavorite={isFavorited}
        initialStatus={currentStatus || ""}
        showFavorite={false}
        showStatus={false}
        saving={savingTracking}
        onClose={() => setNotesModalOpen(false)}
        onSave={async (newNotes, newRating, newProgress, newPlaytime) => {
          try {
            setSavingTracking(true);

            const merged = await updateTrackedGame({
              notes: newNotes,
              rating: newRating,
              progress: newProgress,
              playtime: newPlaytime,
            });

            setNotes(merged.notes || "");
            setRating(merged.rating || 0);
            setProgress(merged.progress || 0);
            setPlaytime(merged.playtime || 0);
          } catch (err) {
            toast.error("Failed to save tracking.");
          } finally {
            setSavingTracking(false);
          }
        }}
      />

      {/* Delete Modal */}
      <ConfirmModal
        open={deleteModalOpen}
        title="Delete Game"
        message={
          <p>
            Are you sure you want to remove{" "}
            <span className="font-semibold">{game?.name}</span> from your game
            list?
          </p>
        }
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={async () => {
          setDeleting(true);
          if (!user || !game) return;

          try {
            const ref = doc(db, "users", user.uid);
            const snap = await getDoc(ref);
            const trackedGames = snap.data()?.trackedGames || {};
            delete trackedGames[String(game.id)];
            await updateDoc(ref, { trackedGames });

            setCurrentStatus(null);
            setIsFavorited(false);
            setNotes("");
            setRating(0);
            setProgress(0);
            setPlaytime(0);

            toast.success(`${game.name} removed from tracked games`);
            setDeleteModalOpen(false);
          } catch (err) {
            console.error(err);
            toast.error("Failed to remove game.");
          } finally {
            setDeleting(false);
          }
        }}
        confirmText={
          deleting ? (
            <span className="flex items-center gap-2">
              <span className="loading loading-spinner loading-sm" /> Deleting
            </span>
          ) : (
            "Delete"
          )
        }
        cancelText="Cancel"
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  FaHeart,
  FaPlaystation,
  FaXbox,
  FaApple,
  FaAndroid,
  FaSteam,
  FaGoogle,
  FaStar,
  FaPause,
  FaPlay,
  FaCrown,
} from "react-icons/fa";
import { SiEpicgames, SiGogdotcom } from "react-icons/si";
import { BsNintendoSwitch } from "react-icons/bs";
import { IoLogoGameControllerA } from "react-icons/io";
import { GiWantedReward } from "react-icons/gi";
import { MdBookmarkRemove } from "react-icons/md";
import { TbBucketDroplet } from "react-icons/tb";

import { useUser } from "@/app/context/UserContext";
import ScreenshotsCarousel from "@/app/components/Screenshots";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import NotesModal from "@/app/components/Notes";
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
    label: "Want to Play",
    icon: <GiWantedReward size={20} />,
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

  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playtime, setPlaytime] = useState(0);

  const [youtubeTrailerId, setYoutubeTrailerId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // Fetch trailer
  useEffect(() => {
    if (!game?.name) return;
    const fetchYoutubeTrailer = async () => {
      try {
        const res = await fetch(
          `/api/getTrailer?game=${encodeURIComponent(game.name)}`
        );
        const data = await res.json();
        setYoutubeTrailerId(data.id);
      } catch (err) {
        console.error("Failed to fetch trailer", err);
      }
    };
    fetchYoutubeTrailer();
  }, [game?.name]);

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
    if (currentStatus?.trim().toLowerCase() === status.toLowerCase()) {
      toast("Status unchanged");
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

  const getStoreIcon = (name: string) => {
    if (/steam/i.test(name)) return <FaSteam />;
    if (/playstation/i.test(name)) return <FaPlaystation />;
    if (/xbox/i.test(name)) return <FaXbox />;
    if (/nintendo/i.test(name)) return <BsNintendoSwitch />;
    if (/epic/i.test(name)) return <SiEpicgames />;
    if (/android/i.test(name)) return <FaAndroid />;
    if (/apple|ios|app.store/i.test(name)) return <FaApple />;
    if (/gog/i.test(name)) return <SiGogdotcom />;
    if (/google/i.test(name)) return <FaGoogle />;
    return <IoLogoGameControllerA />;
  };

  return (
    <div className="relative min-h-screen text-white bg-transparent">
      {/* HERO BACKGROUND */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 z-0"
      >
        {youtubeTrailerId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeTrailerId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeTrailerId}&modestbranding=1&rel=0`}
            className="w-full h-full object-cover"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <img
            src={game.background_image}
            className="w-full h-full object-cover brightness-[0.45]"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-b from-black/20 to-black" />
      </motion.div>

      {/* MAIN CONTENT */}
      <main className="relative flex flex-col md:flex-row gap-12 z-10 p-6 md:p-12 max-w-[1800px] mx-auto">
        {/* Center content */}
        <div className="flex-1 flex flex-col gap-8">
          {/* Poster + Header */}
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            <motion.img
              src={game.background_image}
              className="absoulte w-56 md:w-72 h-80 md:h-96 object-cover rounded-2xl shadow-xl shrink-0"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            />

            <div className="flex-1 space-y-4">
              <h1 className="text-5xl md:text-6xl font-extrabold drop-shadow-xl">
                {game.name}
              </h1>

              {/* Favorite */}
              <div>
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
                  onClick={() => setNotesModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 transition font-semibold text-base cursor-pointer hover:scale-105"
                >
                  📝 Notes
                </button>

                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition font-semibold text-base cursor-pointer hover:scale-105"
                >
                  <MdBookmarkRemove size={20} /> Remove
                </button>
              </div>

              {/* About */}
              <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                <h2 className="text-2xl font-bold mb-3">About</h2>
                <p className="text-white/80 text-base leading-relaxed">
                  {game.description_raw}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center">
                  <div className="text-sm opacity-70">Rating</div>
                  <div className="flex justify-center items-center gap-1 text-xl font-bold">
                    {game.rating} <FaStar className="text-amber-300" />
                  </div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center">
                  <div className="text-sm opacity-70">Release</div>
                  <div className="text-base font-semibold">{game.released}</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center">
                  <div className="text-sm opacity-70">Metacritic</div>
                  <div className="text-xl font-bold">
                    {game.metacritic ?? "N/A"}
                  </div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center">
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
        <div className="w-full md:w-80 shrink-0 space-y-6 sticky top-28">
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4">
            <h2 className="text-lg font-bold mb-2">
              Where to Get / Download Game
            </h2>
            <div className="flex flex-col gap-2">
              {game.stores?.map((s: any, i: number) => (
                <a
                  key={`store-${i}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  href={s.url}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 hover:scale-105 transition text-sm"
                >
                  {getStoreIcon(s.store?.name)}
                  <span>{s.store?.name}</span>
                </a>
              ))}

              {/* FitGirl */}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`https://fitgirl-repacks.site/?s=${encodeURIComponent(
                  game.name
                )}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 hover:scale-105 transition text-sm"
              >
                <img
                  src="/logos/Fitgirl.jpg"
                  alt="FitGirl"
                  className="w-5 h-5 rounded-full"
                />
                <span>FitGirl</span>
              </a>

              {/* Dodi */}
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`https://dodirepack.com/?s=${encodeURIComponent(
                  game.name
                )}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:scale-105  hover:bg-white/20 transition text-sm"
              >
                <img
                  src="/logos/DODI.jpg"
                  alt="Dodi"
                  className="w-5 h-5 rounded-full"
                />
                <span>Dodi</span>
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
                <span>Skidrow</span>
              </a>

              {/* GameDrive */}
              <a
                key="gamedrive"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://gamedrive.org/?s=${encodeURIComponent(
                  game.name
                )}`}
                className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=gamedrive.org&sz=64`}
                  className="w-5 h-5 rounded-full"
                />

                <span>GameDrive</span>
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Notes Modal */}
      <NotesModal
        open={notesModalOpen}
        initialNotes={notes || ""}
        initialRating={rating || 0}
        initialProgress={progress || 0}
        initialPlaytime={playtime || 0}
        onClose={() => setNotesModalOpen(false)}
        onSave={async (newNotes, newRating, newProgress, newPlaytime) => {
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

// "use client";

// import { useEffect, useState } from "react";
// import { motion } from "framer-motion";
// import {
//   FaHeart,
//   FaPlaystation,
//   FaXbox,
//   FaApple,
//   FaAndroid,
//   FaSteam,
//   FaGoogle,
//   FaStar,
//   FaPause,
//   FaPlay,
// } from "react-icons/fa";
// import { SiEpicgames, SiGogdotcom } from "react-icons/si";
// import { BsNintendoSwitch } from "react-icons/bs";
// import { IoLogoGameControllerA } from "react-icons/io";
// import { useParams } from "next/navigation";
// import toast from "react-hot-toast";

// import { useUser } from "@/app/context/UserContext";
// import ScreenshotsCarousel from "@/app/components/Screenshots";
// import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
// import { db } from "@/app/lib/firebase";
// import { TbNumber100Small } from "react-icons/tb";
// import { IoTrashBin } from "react-icons/io5";
// import NotesModal from "@/app/components/Notes";
// import { GiWantedReward } from "react-icons/gi";
// import ConfirmModal from "@/app/components/ConfirmModal";
// import LoadingSpinner from "@/app/components/LoadingSpinner";

// const statuses = [
//   { label: "Playing", icon: <FaPlay />, color: "bg-blue-500" },
//   { label: "On Hold", icon: <FaPause />, color: "bg-yellow-500" },
//   { label: "Dropped", icon: <IoTrashBin size={15} />, color: "bg-red-500" },
//   {
//     label: "Completed",
//     icon: <TbNumber100Small size={20} />,
//     color: "bg-green-500",
//   },
//   {
//     label: "Want to Play",
//     icon: <GiWantedReward size={20} />,
//     color: "bg-green-500",
//   },
// ];

// type StatusType = string | null;

// export default function GamePageCompact() {
//   const { id } = useParams();
//   const { user } = useUser();

//   const [game, setGame] = useState<any>(null);
//   const [isFavorited, setIsFavorited] = useState(false);
//   const [currentStatus, setCurrentStatus] = useState<StatusType>(null);
//   const [loadingFavorite, setLoadingFavorite] = useState(false);
//   const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
//   const [loadingGame, setLoadingGame] = useState(false);

//   //Notes states
//   const [notesModalOpen, setNotesModalOpen] = useState(false);
//   const [notes, setNotes] = useState("");
//   const [rating, setRating] = useState(0);
//   const [progress, setProgress] = useState(0);
//   const [playtime, setPlaytime] = useState(0);

//   //trailer states and modal (coming soon)
//   const [youtubeTrailerId, setYoutubeTrailerId] = useState<string | null>(null);

//   //delete state and modal
//   const [deleteModalOpen, setDeleteModalOpen] = useState(false);
//   const [deleting, setDeleting] = useState(false);

//   useEffect(() => {
//     const fetchGame = async () => {
//       setLoadingGame(true);
//       try {
//         // 1️⃣ Fetch main game data
//         const res = await fetch(
//           `https://api.rawg.io/api/games/${id}?key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
//         );
//         const data = await res.json();
//         setGame(data);

//         // 2️⃣ Fetch screenshots
//         const screenshotsRes = await fetch(
//           `https://api.rawg.io/api/games/${id}/screenshots?key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
//         );
//         const screenshotsData = await screenshotsRes.json();

//         // Add screenshots to game state
//         setGame((prev: any) => ({
//           ...prev,
//           short_screenshots: screenshotsData.results, // this will feed your carousel
//         }));
//       } catch (err) {
//         console.error(err);
//       } finally {
//         setLoadingGame(false);
//       }
//     };

//     fetchGame();
//   }, [id]);

//   useEffect(() => {
//     if (!game?.name) return;

//     const fetchYoutubeTrailer = async () => {
//       try {
//         const res = await fetch(
//           `/api/getTrailer?game=${encodeURIComponent(game.name)}`
//         );
//         const data = await res.json();
//         setYoutubeTrailerId(data.id);
//       } catch (err) {
//         console.error("Failed to fetch trailer", err);
//       }
//     };

//     fetchYoutubeTrailer();
//   }, [game?.name]);

//   useEffect(() => {
//     if (!user || !game) return;

//     const fetchUserTracked = async () => {
//       const snap = await getDoc(doc(db, "users", user.uid));
//       const trackedGames = snap.data()?.trackedGames || {};

//       // Ensure key type matches
//       const tracked = trackedGames[String(game.id)] || trackedGames[game.id];

//       if (tracked) {
//         setIsFavorited(Boolean(tracked.favorite));
//         setCurrentStatus(tracked.status || null);
//         setNotes(tracked.notes || "");
//         setRating(tracked.rating || "");
//         setProgress(tracked.progress || "");
//         setPlaytime(tracked.playtime || "");
//       }
//     };

//     fetchUserTracked();
//   }, [user, game, currentStatus]);

//   const updateTrackedGame = async (patch: Partial<any>) => {
//     if (!user || !game) return;

//     const ref = doc(db, "users", user.uid);
//     const snap = await getDoc(ref);

//     const trackedGames = snap.exists() ? snap.data().trackedGames || {} : {};

//     // merge previous tracked info with patch
//     const merged = {
//       ...(trackedGames[String(game.id)] || {}),
//       ...patch, // patch contains status/favorite
//       id: game.id,
//       name: game.name,
//       background_image: game.background_image,
//       my_rating: game.rating,
//     };

//     await updateDoc(ref, {
//       trackedGames: { ...trackedGames, [String(game.id)]: merged },
//     });

//     return merged;
//   };

//   const handleFavoriteToggle = async () => {
//     if (!game) return;
//     try {
//       setLoadingFavorite(true);
//       const newFav = !isFavorited;
//       const merged = await updateTrackedGame({
//         favorite: newFav,
//         status: currentStatus,
//       });
//       setIsFavorited(Boolean(merged.favorite));
//       toast.success(
//         `${game.name} ${
//           newFav ? "added to favorites" : "removed from favorites"
//         }`
//       );
//     } catch (err) {
//       console.error(err);
//       toast.error("Failed to update favorite.");
//     } finally {
//       setLoadingFavorite(false);
//     }
//   };

//   const handleChangeStatus = async (status: string) => {
//     if (!game) return;

//     if (currentStatus?.trim().toLowerCase() === status.toLowerCase()) {
//       toast("Status unchanged");
//       return;
//     }

//     try {
//       setLoadingStatus(status);

//       // Update Firestore
//       const merged = await updateTrackedGame({
//         status,
//         favorite: isFavorited,
//         lastUpdated: serverTimestamp(),
//       });

//       setCurrentStatus(merged.status?.trim() || null);
//       toast.success(`${game.name} marked as ${status}`);
//     } catch {
//       toast.error("Failed to update status.");
//     } finally {
//       setLoadingStatus(null);
//     }
//   };

//   if (!game || loadingGame) return <LoadingSpinner />;

//   const getStoreIcon = (name: string) => {
//     if (/steam/i.test(name)) return <FaSteam />;
//     if (/playstation/i.test(name)) return <FaPlaystation />;
//     if (/xbox/i.test(name)) return <FaXbox />;
//     if (/nintendo/i.test(name)) return <BsNintendoSwitch />;
//     if (/epic/i.test(name)) return <SiEpicgames />;
//     if (/android/i.test(name)) return <FaAndroid />;
//     if (/apple|ios|app.store/i.test(name)) return <FaApple />;
//     if (/gog/i.test(name)) return <SiGogdotcom />;
//     if (/google/i.test(name)) return <FaGoogle />;
//     return <IoLogoGameControllerA />;
//   };

//   return (
//     <div className="relative min-h-screen text-white bg-transparent">
//       {/* HERO BACKGROUND */}
//       <motion.div
//         initial={{ opacity: 0 }}
//         animate={{ opacity: 1 }}
//         transition={{ duration: 0.6 }}
//         className="absolute inset-0 z-0"
//       >
//         {youtubeTrailerId ? (
//           <iframe
//             src={`https://www.youtube.com/embed/${youtubeTrailerId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeTrailerId}&modestbranding=1&rel=0`}
//             className="w-full h-full object-cover"
//             frameBorder="0"
//             allow="autoplay; encrypted-media"
//             allowFullScreen
//           />
//         ) : (
//           <img
//             src={game.background_image}
//             className="w-full h-full object-cover brightness-[0.45]"
//           />
//         )}

//         <div className="absolute inset-0 bg-linear-to-b from-black/20 to-black" />
//       </motion.div>

//       {/* MAIN */}
//       <main className="relative z-10 p-4 md:p-8 max-w-6xl mx-auto space-y-8">
//         <motion.div
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ duration: 0.6, ease: "easeInOut" }}
//         >
//           <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
//             {/* POSTER */}
//             <motion.img
//               src={game.background_image}
//               className="w-48 md:w-56 h-72 md:h-80 object-cover rounded-2xl shadow-xl shrink-0"
//               initial={{ y: 20, opacity: 0 }}
//               animate={{ y: 0, opacity: 1 }}
//             />

//             {/* MAIN HEADER */}
//             <div className="flex-1 space-y-3">
//               <h1 className="text-4xl md:text-5xl font-extrabold drop-shadow-xl">
//                 {game.name}
//               </h1>

//               {/* STATUS + FAVORITE */}
//               <div className="flex flex-col gap-3">
//                 <div>
//                   <button
//                     onClick={handleFavoriteToggle}
//                     className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-sm border border-white/10 hover:bg-red-500 transition ${
//                       isFavorited ? "bg-red-600" : "bg-white/10"
//                     }`}
//                     disabled={loadingFavorite}
//                   >
//                     {loadingFavorite ? (
//                       <span className="loading loading-spinner loading-sm" />
//                     ) : (
//                       <>
//                         <FaHeart /> {isFavorited ? "Favorited" : "Favorite"}
//                       </>
//                     )}
//                   </button>
//                 </div>

//                 <div className="flex flex-wrap gap-2">
//                   {statuses.map((s) => {
//                     const isSelected =
//                       currentStatus?.trim().toLowerCase() ===
//                       s.label.toLowerCase();

//                     return (
//                       <button
//                         key={s.label}
//                         onClick={() => handleChangeStatus(s.label)}
//                         className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-white/10 transition ${
//                           isSelected ? s.color : "bg-white/10 hover:bg-white/20"
//                         }`}
//                       >
//                         {loadingStatus === s.label ? (
//                           <span className="loading loading-spinner loading-sm" />
//                         ) : (
//                           <>
//                             {s.icon && s.icon}
//                             <span>{s.label}</span>
//                           </>
//                         )}
//                       </button>
//                     );
//                   })}
//                 </div>
//                 <div className="flex justify-between">
//                   <button
//                     onClick={() => setNotesModalOpen(true)}
//                     className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-white/10 bg-purple-500 hover:bg-purple-400 transition font-semibold"
//                   >
//                     📝 Notes
//                   </button>
//                   <div>
//                     <button
//                       onClick={() => setDeleteModalOpen(true)}
//                       className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-white/10 bg-red-600 hover:bg-red-500 transition font-semibold"
//                     >
//                       <IoTrashBin /> Remove
//                     </button>
//                   </div>
//                 </div>
//               </div>
//               {/* DESCRIPTION */}
//               <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
//                 <h2 className="text-xl font-bold mb-2">About</h2>
//                 <p className="text-white/80 text-sm leading-relaxed">
//                   {game.description_raw}
//                 </p>
//               </div>
//               {/* STATS */}
//               <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
//                 <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-center">
//                   <div className="text-xs opacity-70">Rating</div>
//                   <div className="flex justify-center items-center gap-1 text-lg font-bold">
//                     {game.rating} <FaStar className="text-amber-300" />
//                   </div>
//                 </div>
//                 <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-center">
//                   <div className="text-xs opacity-70">Release</div>
//                   <div className="text-sm font-semibold">{game.released}</div>
//                 </div>
//                 <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-center">
//                   <div className="text-xs opacity-70">Metacritic</div>
//                   <div className="text-lg font-bold">
//                     {game.metacritic ?? "N/A"}
//                   </div>
//                 </div>
//                 <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-center">
//                   <div className="text-xs opacity-70">Screenshots</div>
//                   <div className="text-lg font-bold">
//                     {game.short_screenshots?.length}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </motion.div>

//         {/* TRAILER */}
//         {game.clip?.clips?.["320"] ? (
//           <div className="rounded-2xl overflow-hidden shadow-xl border border-white/10 max-h-[400px]">
//             <video
//               src={game.clip.clips["320"]}
//               autoPlay
//               loop
//               muted
//               controls
//               className="w-full h-full object-cover"
//             />
//           </div>
//         ) : game.youtube_count > 0 ? (
//           <button
//             onClick={() =>
//               window.open(
//                 `https://www.youtube.com/results?search_query=${encodeURIComponent(
//                   game.name + " official trailer"
//                 )}`,
//                 "_blank"
//               )
//             }
//             className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 rounded-lg font-bold"
//           >
//             Watch Trailer
//           </button>
//         ) : (
//           <div className="text-white/70 py-4">No trailer available</div>
//         )}

//         {/* SCREENSHOTS */}
//         <ScreenshotsCarousel screenshots={game.short_screenshots} />

//         {/* STORES + HLTB */}
//         <div className="bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4">
//           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
//             {/* Existing stores */}
//             {game.stores?.map((s: any, i: number) => (
//               <a
//                 key={`store-${i}`}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 href={s.url}
//                 className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
//               >
//                 {getStoreIcon(s.store?.name)}
//                 <span>{s.store?.name}</span>
//               </a>
//             ))}

//             {/* FitGirl search */}
//             <a
//               key="fitgirl"
//               target="_blank"
//               rel="noopener noreferrer"
//               href={`https://fitgirl-repacks.site/?s=${encodeURIComponent(
//                 game.name
//               )}`}
//               className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
//             >
//               <img src="/logos/Fitgirl.jpg" alt="FitGirl" className="w-5 h-5" />
//               <span>FitGirl</span>
//             </a>

//             {/* Dodi search */}
//             <a
//               key="dodi"
//               target="_blank"
//               rel="noopener noreferrer"
//               href={`https://dodirepack.com/?s=${encodeURIComponent(
//                 game.name
//               )}`}
//               className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
//             >
//               <img src="/logos/DODI.jpg" alt="Dodi" className="w-5 h-5" />
//               <span>Dodi</span>
//             </a>
//           </div>
//         </div>
//       </main>

//       <NotesModal
//         open={notesModalOpen}
//         initialNotes={notes || ""}
//         initialRating={rating || 0}
//         initialProgress={progress || 0}
//         initialPlaytime={playtime || 0}
//         onClose={() => setNotesModalOpen(false)}
//         onSave={async (newNotes, newRating, newProgress, newPlaytime) => {
//           const merged = await updateTrackedGame({
//             notes: newNotes,
//             rating: newRating,
//             progress: newProgress,
//             playtime: newPlaytime,
//           });
//           setNotes(merged.notes || "");
//           setRating(merged.rating || 0);
//           setProgress(merged.progress || 0);
//           setPlaytime(merged.playtime || 0);
//         }}
//       />

//       <ConfirmModal
//         open={deleteModalOpen}
//         title="Delete Game"
//         message={
//           <p>
//             Are you sure you want to remove{" "}
//             <span className="font-semibold">{game?.name}</span> from your game
//             list?
//           </p>
//         }
//         onCancel={() => setDeleteModalOpen(false)}
//         onConfirm={async () => {
//           setDeleting(true);
//           if (!user || !game) return;

//           try {
//             const ref = doc(db, "users", user.uid);
//             const snap = await getDoc(ref);
//             const trackedGames = snap.data()?.trackedGames || {};

//             delete trackedGames[String(game.id)];

//             await updateDoc(ref, { trackedGames });

//             setCurrentStatus(null);
//             setIsFavorited(false);
//             setNotes("");
//             setRating(0);
//             setProgress(0);
//             setPlaytime(0);

//             toast.success(`${game.name} removed from tracked games`);
//             setDeleteModalOpen(false);
//             setDeleting(false);
//           } catch (err) {
//             console.error(err);
//             toast.error("Failed to remove game.");
//             setDeleting(false);
//           }
//         }}
//         confirmText={
//           deleting ? (
//             <span className="flex items-center gap-2">
//               <span className="loading loading-spinner loading-sm" /> Deleting
//             </span>
//           ) : (
//             "Delete"
//           )
//         }
//         cancelText="Cancel"
//       />
//     </div>
//   );
// }

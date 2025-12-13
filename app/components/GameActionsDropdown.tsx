"use client";

import { useState, useRef, useEffect } from "react";
import { MdMoreVert, MdEdit, MdDelete, MdRefresh } from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../context/UserContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import toast from "react-hot-toast";
import { refreshGameData } from "../utils/refreshGame";

interface GameActionsDropdownProps {
  game: any;
  trackedGames: Record<string, any>;
  openEditModal: (game: any) => void;
  openConfirmModal: (
    message: string,
    action: () => void | Promise<void>
  ) => void; // NEW
}

export default function GameActionsDropdown({
  game,
  trackedGames,
  openEditModal,
  openConfirmModal,
}: GameActionsDropdownProps) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const removeGame = async () => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const updatedGames = { ...trackedGames };
    delete updatedGames[game.id];
    await updateDoc(ref, { trackedGames: updatedGames });
    toast.success(`Removed ${game.name}`);
  };

  const refreshGame = async () => {
    if (!user) return;

    const toastId = toast.loading(`Refreshing ${game.name}...`);

    try {
      await refreshGameData(user.uid, game);
      toast.success(`${game.name} updated!`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error(`Failed to refresh ${game.name}`, { id: toastId });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="absolute top-2 right-2 z-30 px-2 py-2 bg-black/40 text-white/80 rounded-full hover:bg-black/60 hover:scale-110 transition-all duration-300"
      >
        <MdMoreVert size={20} />
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 mt-10 w-36 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-50 overflow-hidden"
          >
            <button
              onClick={() =>
                openConfirmModal(
                  `Are you sure you want to refresh "${game.name}"? Your playtime, notes, and progress will be preserved.`,
                  refreshGame
                )
              }
              className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 w-full text-left"
            >
              <MdRefresh /> Refetch
            </button>
            <button
              onClick={() => openEditModal(game)}
              className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 w-full text-left"
            >
              <MdEdit /> Edit
            </button>
            <button
              onClick={() =>
                openConfirmModal(
                  `Are you sure you want to remove "${game.name}"?`,
                  removeGame
                )
              }
              className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 w-full text-left"
            >
              <MdDelete /> Remove
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// "use client";

// import { useState, useRef, useEffect } from "react";
// import { MdMoreVert, MdEdit, MdDelete, MdRefresh } from "react-icons/md";
// import { motion, AnimatePresence } from "framer-motion";
// import { useUser } from "../context/UserContext";
// import { doc, getDoc, updateDoc } from "firebase/firestore";
// import { db } from "@/app/lib/firebase";
// import toast from "react-hot-toast";

// interface GameActionsDropdownProps {
//   game: any;
//   trackedGames: Record<string, any>;
//   openEditModal: (game: any) => void;
//   openConfirmModal: (
//     message: string,
//     action: () => void | Promise<void>
//   ) => void; // NEW
// }

// export default function GameActionsDropdown({
//   game,
//   trackedGames,
//   openEditModal,
//   openConfirmModal,
// }: GameActionsDropdownProps) {
//   const { user } = useUser();
//   const [open, setOpen] = useState(false);
//   const dropdownRef = useRef<HTMLDivElement | null>(null);

//   useEffect(() => {
//     const handleClickOutside = (e: MouseEvent) => {
//       if (
//         dropdownRef.current &&
//         !dropdownRef.current.contains(e.target as Node)
//       ) {
//         setOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   const removeGame = async () => {
//     if (!user) return;
//     const ref = doc(db, "users", user.uid);
//     const updatedGames = { ...trackedGames };
//     delete updatedGames[game.id];
//     await updateDoc(ref, { trackedGames: updatedGames });
//     toast.success(`Removed ${game.name}`);
//   };

//   const refreshGame = async () => {
//     if (!user) return;

//     const toastId = toast.loading(`Refreshing ${game.name}...`);

//     try {
//       // 1. ---- RAWG Search ----
//       const searchRes = await fetch(
//         `https://api.rawg.io/api/games?search=${encodeURIComponent(
//           game.name
//         )}&key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
//       );
//       if (!searchRes.ok) throw new Error("RAWG search failed");

//       const searchData = await searchRes.json();
//       const first = searchData.results?.[0];
//       if (!first) throw new Error("Game not found on RAWG");

//       // 2. ---- RAWG Full Game Data ----
//       const rawgRes = await fetch(
//         `https://api.rawg.io/api/games/${first.slug}?key=${process.env.NEXT_PUBLIC_RAWG_API_KEY}`
//       );
//       if (!rawgRes.ok) throw new Error("RAWG fetch failed");

//       const rawg = await rawgRes.json();

//       // 3. ---- Load existing user game fields ----
//       const ref = doc(db, "users", user.uid);
//       const snap = await getDoc(ref);
//       const currentGames = snap.exists() ? snap.data().trackedGames || {} : {};
//       const existing = currentGames[String(game.id)] || {};

//       // USER fields you want to preserve:
//       const preservedUserFields = {
//         playtime: existing.playtime || 0,
//         progress: existing.progress || 0,
//         my_rating: existing.my_rating || 0,
//         favorite: existing.favorite || false,
//         status: existing.status || "",
//         notes: existing.notes || "",
//         categoryRatings: existing.categoryRatings || {
//           graphics: 0,
//           gameplay: 0,
//           story: 0,
//           fun: 0,
//         },
//       };

//       // 4. ---- RAWG fields you want to refresh ----
//       const rawgFields = {
//         name: rawg.name,
//         slug: rawg.slug,
//         released: rawg.released || "TBA",
//         background_image: rawg.background_image || "/placeholder-game.jpg",
//         background_image_additional: rawg.background_image_additional || null,
//         metacritic: rawg.metacritic,
//         genres: rawg.genres,
//         platforms: rawg.platforms,
//         publishers: rawg.publishers,
//       };

//       // 5. ---- Merge RAWG + User Fields ----
//       const merged = {
//         ...existing,
//         ...rawgFields,
//         ...preservedUserFields,
//         id: game.id,
//       };

//       // 6. ---- Save to Firebase ----
//       await updateDoc(ref, {
//         trackedGames: {
//           ...currentGames,
//           [String(game.id)]: merged,
//         },
//       });

//       toast.success(`${game.name} updated!`, { id: toastId });
//     } catch (err) {
//       console.error(err);
//       toast.error(`Failed to refresh ${game.name}`, { id: toastId });
//     }
//   };

//   return (
//     <div className="relative" ref={dropdownRef}>
//       {/* Trigger button */}
//       <button
//         type="button"
//         onClick={(e) => {
//           e.preventDefault();
//           e.stopPropagation();
//           setOpen((prev) => !prev);
//         }}
//         className="absolute top-2 right-2 z-30 px-2 py-2 bg-black/40 text-white/80 rounded-full hover:bg-black/60 hover:scale-110 transition-all duration-300"
//       >
//         <MdMoreVert size={20} />
//       </button>

//       {/* Dropdown menu */}
//       <AnimatePresence>
//         {open && (
//           <motion.div
//             initial={{ opacity: 0, scale: 0.95 }}
//             animate={{ opacity: 1, scale: 1 }}
//             exit={{ opacity: 0, scale: 0.95 }}
//             className="absolute right-0 mt-10 w-36 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-50 overflow-hidden"
//           >
//             <button
//               onClick={() => openEditModal(game)}
//               className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 w-full text-left"
//             >
//               <MdEdit /> Edit
//             </button>
//             <button
//               onClick={() =>
//                 openConfirmModal(
//                   `Are you sure you want to remove "${game.name}"?`,
//                   removeGame
//                 )
//               }
//               className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 w-full text-left"
//             >
//               <MdDelete /> Remove
//             </button>
//             <button
//               onClick={() =>
//                 openConfirmModal(
//                   `Are you sure you want to refresh "${game.name}"? Your playtime, notes, and progress will be preserved.`,
//                   refreshGame
//                 )
//               }
//               className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 w-full text-left"
//             >
//               <MdRefresh /> Refresh
//             </button>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }

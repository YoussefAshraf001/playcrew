"use client";

import { useState, useRef, useEffect } from "react";
import { MdMoreVert, MdEdit, MdDelete, MdRefresh } from "react-icons/md";
import { FaCode } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "../context/UserContext";
import { deleteDoc, doc } from "firebase/firestore";
import toast from "react-hot-toast";
import { refreshGameData } from "../utils/refreshGame";
import DevGameEditor from "./DevButton";
import { db } from "@/app/lib/firebase";
import { createPortal } from "react-dom";

interface GameActionsDropdownProps {
  game: any;
  trackedGames: Record<string, any>;
  openEditModal: (game: any) => void;
  openConfirmModal: (
    message: string,
    action: () => void | Promise<void>
  ) => void;
}

export default function GameActionsDropdown({
  game,
  openEditModal,
  openConfirmModal,
}: GameActionsDropdownProps) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  const [refreshModalOpen, setRefreshModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [devModalOpen, setDevModalOpen] = useState(false);
  const [fieldsToRefresh, setFieldsToRefresh] = useState<
    Record<string, boolean>
  >({
    name: true,
    slug: true,
    released: true,
    background_image: true,
    background_image_additional: true,
    genres: true,
    platforms: true,
    publishers: true,
  });

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
    try {
      const ref = doc(db, "users", user.uid, "games", game.id.toString());
      await deleteDoc(ref);
      toast.success(`Removed ${game.name}`);
    } catch (err) {
      console.error("Failed to remove game:", err);
      toast.error("Failed to remove game");
    }
  };

  const handleRefreshClick = async () => {
    if (!user) return;

    try {
      setIsRefreshing(true);
      await refreshGameData(user.uid, game, fieldsToRefresh);
      toast.success(`${game.name} updated!`);
      setRefreshModalOpen(false);
      setFieldsToRefresh({
        name: true,
        slug: true,
        released: true,
        background_image: true,
        background_image_additional: true,
        genres: true,
        platforms: true,
        publishers: true,
      });
      // No manual refetch needed — snapshot will update UI automatically
    } catch (err) {
      console.error(err);
      toast.error(`Failed to refresh ${game.name}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
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

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 mt-10 w-36 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-50 overflow-hidden"
          >
            <button
              onClick={() => setRefreshModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 w-full text-left"
            >
              <MdRefresh /> Refresh
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

            <button
              onClick={() => setDevModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 w-full text-left"
            >
              <FaCode /> Dev Mode
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {devModalOpen && user && (
        <DevGameEditor
          userId={user.uid}
          game={game}
          onClose={() => setDevModalOpen(false)}
        />
      )}

      {refreshModalOpen &&
        createPortal(
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-zinc-900 p-6 rounded-2xl w-[360px] max-w-[90%] shadow-xl relative"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              {/* Close button */}
              <button
                onClick={() => {
                  setRefreshModalOpen(false);
                  setFieldsToRefresh({
                    name: true,
                    slug: true,
                    released: true,
                    background_image: true,
                    background_image_additional: true,
                    genres: true,
                    platforms: true,
                    publishers: true,
                  });
                }}
                className="absolute top-3 right-3 text-white/70 hover:text-white text-2xl font-bold"
              >
                ×
              </button>

              <h2 className="text-xl font-bold mb-5 text-center text-white">
                Select Fields to Refresh
              </h2>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {Object.keys(fieldsToRefresh).map((key) => {
                  // Map Firestore keys to display labels
                  const displayNameMap: Record<string, string> = {
                    name: "Name",
                    slug: "Slug",
                    released: "Release Date",
                    background_image: "Poster",
                    background_image_additional: "Fallback Poster",
                    genres: "Genres",
                    platforms: "Platforms",
                    publishers: "Publishers",
                  };
                  const displayName = displayNameMap[key] || key;

                  return (
                    <motion.button
                      key={key}
                      onClick={() =>
                        setFieldsToRefresh((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                      whileTap={{ scale: 0.95 }}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200
                  ${
                    fieldsToRefresh[key]
                      ? "bg-emerald-500 text-black shadow-md"
                      : "bg-zinc-700 text-white/70 hover:bg-zinc-600"
                  }`}
                    >
                      {displayName}
                    </motion.button>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3">
                <motion.button
                  onClick={() => {
                    setRefreshModalOpen(false);
                    setFieldsToRefresh({
                      name: true,
                      slug: true,
                      released: true,
                      background_image: true,
                      background_image_additional: true,
                      genres: true,
                      platforms: true,
                      publishers: true,
                    });
                  }}
                  whileTap={{ scale: 0.95 }}
                  className="px-5 py-2 rounded-lg bg-zinc-700 text-white/80 hover:bg-zinc-600 transition-all"
                >
                  Cancel
                </motion.button>

                <motion.button
                  onClick={handleRefreshClick}
                  whileTap={{ scale: 0.95 }}
                  className="px-5 py-2 rounded-lg bg-emerald-500 text-black font-semibold hover:bg-emerald-600 transition-all shadow-md"
                >
                  {isRefreshing ? (
                    <div className="flex justify-center items-center gap-2 w-full">
                      <span className="loading loading-spinner loading-xs" />
                    </div>
                  ) : (
                    "Refresh"
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>,
          document.body
        )}
    </div>
  );
}

// "use client";

// import { useState, useRef, useEffect } from "react";
// import { MdMoreVert, MdEdit, MdDelete, MdRefresh } from "react-icons/md";
// import { motion, AnimatePresence } from "framer-motion";
// import { useUser } from "../context/UserContext";
// import { doc, updateDoc } from "firebase/firestore";
// import toast from "react-hot-toast";
// import { refreshGameData } from "../utils/refreshGame";
// import DevGameEditor from "./DevButton";
// import { db } from "@/app/lib/firebase";
// import { FaCode } from "react-icons/fa";

// interface GameActionsDropdownProps {
//   game: any;
//   trackedGames: Record<string, any>;
//   openEditModal: (game: any) => void;
//   openConfirmModal: (
//     message: string,
//     action: () => void | Promise<void>
//   ) => void;
// }

// export default function GameActionsDropdown({
//   game,
//   trackedGames,
//   openEditModal,
//   openConfirmModal,
// }: GameActionsDropdownProps) {
//   const { user } = useUser();
//   const [open, setOpen] = useState(false);
//   const [devModalOpen, setDevModalOpen] = useState(false);
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
//       await refreshGameData(user.uid, game);
//       toast.success(`${game.name} updated!`, { id: toastId });
//     } catch (err) {
//       console.error(err);
//       toast.error(`Failed to refresh ${game.name}`, { id: toastId });
//     }
//   };

//   return (
//     <div className="relative" ref={dropdownRef}>
//       {/* 3-dots trigger */}
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
//               onClick={() =>
//                 openConfirmModal(
//                   `This will reset game data stored and refetch them from RAWG for ${game.name}. Your playtime, notes, and progress wont be affected.`,
//                   refreshGame
//                 )
//               }
//               className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 w-full text-left"
//             >
//               <MdRefresh /> Refetch
//             </button>

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

//             {/* DEV EDIT */}
//             <button
//               onClick={() => setDevModalOpen(true)}
//               className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-800 w-full text-left"
//             >
//               <FaCode /> Dev Mode
//             </button>
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {/* Dev editor modal */}
//       {devModalOpen && user && (
//         <DevGameEditor
//           userId={user.uid}
//           game={game}
//           onClose={() => setDevModalOpen(false)}
//         />
//       )}
//     </div>
//   );
// }

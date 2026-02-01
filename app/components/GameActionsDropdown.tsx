"use client";

import { useState, useRef, useEffect } from "react";
import { MdMoreVert, MdEdit, MdDelete, MdRefresh } from "react-icons/md";
import { FaCode } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { deleteDoc, doc } from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/app/lib/firebase";
import { refreshGameData } from "../utils/refreshGame";
import { useUser } from "../context/UserContext";
import DevGameEditor from "./DevButton";
import { createPortal } from "react-dom";

export type RefreshField =
  | "name"
  | "cover"
  | "genres"
  | "rating"
  | "platforms"
  | "released";

interface Props {
  game: any;
  openEditModal: (game: any) => void;
  openConfirmModal: (
    message: string,
    action: () => void | Promise<void>,
  ) => void;
}

export default function GameActionsDropdown({
  game,
  openEditModal,
  openConfirmModal,
}: Props) {
  const { user } = useUser();

  const [open, setOpen] = useState(false);
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [devModalOpen, setDevModalOpen] = useState(false);

  const [fields, setFields] = useState<Record<RefreshField, boolean>>({
    name: true,
    cover: true,
    genres: true,
    rating: true,
    platforms: true,
    released: true,
  });

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  /* ---------------- close on outside click ---------------- */
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ---------------- refresh ---------------- */
  const handleRefresh = async () => {
    if (!user) return;

    try {
      setRefreshing(true);

      await refreshGameData(
        user.uid,
        game,
        fields,
        game._docId ?? game.igdb.id.toString(),
      );

      toast.success(`${game.name} Was Successfully Refreshed`);
      setRefreshOpen(false);
      setFields({
        name: true,
        cover: true,
        genres: true,
        rating: true,
        platforms: true,
        released: true,
      });
    } catch (err) {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const refreshKeys: RefreshField[] = [
    "name",
    "cover",
    "genres",
    "rating",
    "platforms",
    "released",
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 3 DOT BUTTON */}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        className="absolute top-2 right-2 z-50 bg-black/70 text-white p-2 rounded-full hover:bg-black transition"
      >
        <MdMoreVert size={18} />
      </button>

      {/* DROPDOWN */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-2 top-12 z-50 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* REFRESH */}
            <button
              onClick={() => setRefreshOpen(true)}
              className="w-full px-4 py-2 flex items-center gap-2 hover:bg-zinc-800"
            >
              <MdRefresh /> Refresh
            </button>

            {/* EDIT */}
            <button
              onClick={() => openEditModal(game)}
              className="w-full px-4 py-2 flex items-center gap-2 hover:bg-zinc-800"
            >
              <MdEdit /> Edit
            </button>

            {/* DEV MODE */}
            <button
              onClick={() => setDevModalOpen(true)}
              className="w-full px-4 py-2 flex items-center gap-2 text-indigo-400 hover:bg-indigo-500/10"
            >
              <FaCode /> Dev Mode
            </button>

            {/* DELETE */}
            <button
              onClick={() =>
                openConfirmModal(`Delete "${game.name}"?`, async () => {
                  await deleteDoc(
                    doc(
                      db,
                      "users",
                      user!.uid,
                      "games_igdb",
                      game._docId ?? game.igdb.id.toString(),
                    ),
                  );
                })
              }
              className="w-full px-4 py-2 flex items-center gap-2 text-red-400 hover:bg-red-500/10"
            >
              <MdDelete /> Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REFRESH MODAL */}
      {refreshOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
            <div className="bg-zinc-900 p-6 rounded-xl w-[400px]">
              <h2 className="text-lg font-bold mb-4">Refetch Data From IGDB</h2>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {refreshKeys.map((key) => (
                  <button
                    key={key}
                    onClick={() => setFields((p) => ({ ...p, [key]: !p[key] }))}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition
                ${
                  fields[key]
                    ? "bg-emerald-500 text-black"
                    : "bg-zinc-700 text-white/70 hover:bg-zinc-600"
                }`}
                  >
                    {key === "released"
                      ? "Release Date"
                      : key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setRefreshOpen(false);
                    setFields({
                      name: true,
                      cover: true,
                      genres: true,
                      rating: true,
                      platforms: true,
                      released: true,
                    });
                  }}
                  className="px-4 py-2 bg-zinc-700 rounded-lg"
                >
                  Cancel
                </button>

                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="w-25 h-10 px-4 py-2 bg-emerald-500 text-black rounded-lg"
                >
                  {refreshing ? (
                    <>
                      <span className="loading loading-dots loading-md" />
                    </>
                  ) : (
                    "Refresh"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body, // ✅ REQUIRED
        )}

      {/* DEV MODAL */}
      {devModalOpen && user && (
        <DevGameEditor
          userId={user.uid}
          game={{
            ...game,
            _docId: game._docId ?? game.igdb.id.toString(),
          }}
          onClose={() => setDevModalOpen(false)}
        />
      )}
    </div>
  );
}

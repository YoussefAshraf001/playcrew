"use client";

import { useState, useRef, useEffect } from "react";
import { MdMoreVert, MdEdit, MdDelete, MdRefresh } from "react-icons/md";
import { FaCode } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { deleteDoc, doc } from "firebase/firestore";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

import { db } from "@/app/lib/firebase";
import { refreshGameData } from "../utils/refreshGame";
import { useUser } from "../context/UserContext";
import DevGameEditor from "./DevButton";

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
    name: false,
    cover: false,
    genres: false,
    rating: false,
    platforms: false,
    released: false,
  });

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const refreshKeys: RefreshField[] = [
    "name",
    "cover",
    "genres",
    "rating",
    "platforms",
    "released",
  ];
  const allFieldsSelected = refreshKeys.every((key) => fields[key]);
  const selectedCount = refreshKeys.filter((key) => fields[key]).length;

  const resetFields = () =>
    setFields({
      name: false,
      cover: false,
      genres: false,
      rating: false,
      platforms: false,
      released: false,
    });

  useEffect(() => {
    const closeOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setRefreshOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);

    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  useEffect(() => {
    const closeOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setRefreshOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);

    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  const handleRefresh = async () => {
    if (!user || selectedCount === 0) return;

    try {
      setRefreshing(true);

      await refreshGameData(
        user.uid,
        game,
        fields,
        game._docId ?? game.igdb.id.toString(),
      );

      toast.success(
        <span>
          <span className="font-bold pr-1">{game.name}</span>
          <span className="text-black"> was refreshed</span>
        </span>,
      );
      setRefreshOpen(false);
      resetFields();
    } catch (err) {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const actionBtnClass =
    "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition duration-150";

  return (
    <div className="relative text-sm" ref={dropdownRef}>
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
        aria-label="Game actions"
        className={`absolute right-2 top-2 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/70 text-zinc-100 shadow-[0_8px_20px_rgba(0,0,0,0.45)] backdrop-blur-sm transition hover:scale-105 hover:border-cyan-300/50 hover:bg-zinc-900/90 hover:text-cyan-100 ${
          open ? "border-cyan-300/60 text-cyan-100" : ""
        }`}
      >
        <MdMoreVert size={18} />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="absolute right-2 top-14 z-50 w-56 overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 rounded-lg border border-white/10 bg-white/3 px-3 py-2">
            <p className="truncate text-[11px] uppercase tracking-[0.16em] text-zinc-400">
              Actions For
            </p>
            <p className="truncate text-sm font-semibold text-zinc-100">
              {game?.name ?? "Game"}
            </p>
          </div>

          <button
            onClick={() => {
              setRefreshOpen(true);
              setOpen(false);
            }}
            className={`${actionBtnClass} text-zinc-100 hover:bg-white/10`}
          >
            <MdRefresh className="text-base text-cyan-300" />
            <span>Refresh Game</span>
          </button>

          <button
            onClick={() => {
              openEditModal(game);
              setOpen(false);
            }}
            className={`${actionBtnClass} text-zinc-100 hover:bg-white/10`}
          >
            <MdEdit className="text-base text-zinc-200" />
            <span>Edit Game</span>
          </button>

          <button
            onClick={() => {
              setDevModalOpen(true);
              setOpen(false);
            }}
            className={`${actionBtnClass} text-indigo-200 hover:bg-indigo-500/15`}
          >
            <FaCode className="text-sm text-indigo-300" />
            <span>Dev Mode</span>
          </button>

          <div className="my-2 h-px bg-white/10" />

          <button
            onClick={() => {
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
              });
              setOpen(false);
            }}
            className={`${actionBtnClass} text-red-200 hover:bg-red-500/20`}
          >
            <MdDelete className="text-base text-red-300" />
            <span>Remove from Library</span>
          </button>
          <div className="my-2 h-px bg-white/10" />
        </motion.div>
      )}

      {refreshOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
            onClick={() => setRefreshOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-md sm:p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                IGDB Sync
              </p>
              <h2 className="mt-1 text-lg font-bold text-white">
                Refresh Game Data
              </h2>
              <p className="mt-1 text-xs text-zinc-300">
                Choose fields to update for{" "}
                <span className="font-semibold">{game?.name}</span>.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {refreshKeys.map((key) => (
                  <button
                    key={key}
                    onClick={() => setFields((p) => ({ ...p, [key]: !p[key] }))}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                      fields[key]
                        ? "border-cyan-300/60 bg-cyan-400/20 text-cyan-100"
                        : "border-white/10 bg-zinc-900 text-zinc-300 hover:border-white/30 hover:bg-zinc-800"
                    }`}
                  >
                    {key === "released"
                      ? "Release Date"
                      : key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (allFieldsSelected) {
                      resetFields();
                      return;
                    }
                    setFields({
                      name: true,
                      cover: true,
                      genres: true,
                      rating: true,
                      platforms: true,
                      released: true,
                    });
                  }}
                  className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-white/10"
                >
                  {allFieldsSelected ? "Clear All" : "Select All"}
                </button>
                <p className="text-[11px] text-zinc-400">
                  {selectedCount} selected
                </p>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setRefreshOpen(false);
                    resetFields();
                  }}
                  className="rounded-lg border border-white/15 bg-black/40 px-4 py-2 text-sm text-zinc-100 transition hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  onClick={handleRefresh}
                  disabled={refreshing || selectedCount === 0}
                  className="inline-flex h-10 min-w-28 items-center justify-center rounded-lg bg-linear-to-r from-cyan-200 to-cyan-400 px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {refreshing ? (
                    <span className="loading loading-dots loading-md" />
                  ) : (
                    "Refresh"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

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

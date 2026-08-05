"use client";

import { useState, useRef, useEffect } from "react";
import { MdMoreVert, MdEdit, MdDelete, MdRefresh } from "react-icons/md";
import { FaCode } from "react-icons/fa";
import { motion } from "framer-motion";
import { deleteDoc, doc } from "firebase/firestore";
import toast from "react-hot-toast";

import RefreshModal, { type RefreshField } from "./RefreshModal";
import { db } from "@/app/lib/firebase";
import { refreshGameData } from "../utils/refreshGame";
import { useUser } from "../context/UserContext";
import DevGameEditor from "./DevButton";

interface Props {
  game: any;
  openEditModal: (game: any) => void;
  openConfirmModal: (
    message: string,
    action: () => void | Promise<void>,
  ) => void;
  isHovered?: boolean;
}

export default function GameActionsDropdown({
  game,
  openEditModal,
  openConfirmModal,
  isHovered,
}: Props) {
  const { user, isAdmin } = useUser();

  const [open, setOpen] = useState(false);
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [devModalOpen, setDevModalOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

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
    if (refreshOpen || devModalOpen) {
      setOpen(false);
    }
  }, [refreshOpen, devModalOpen]);

  useEffect(() => {
    if (isHovered === false) {
      setOpen(false);
    }
  }, [isHovered]);

  const handleRefresh = async (fields: Record<RefreshField, boolean>) => {
    if (!user) return;

    try {
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
    } catch (err) {
      toast.error("Refresh failed");
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
        className={`absolute right-2 top-2 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/70 text-zinc-100 shadow-[0_8px_20px_rgba(0,0,0,0.45)] backdrop-blur-sm
          opacity-0
          scale-75
          pointer-events-none

          transition-all
          duration-300

          group-hover:opacity-100
          group-hover:scale-100
          group-hover:pointer-events-auto

          hover:scale-105
          hover:border-cyan-300/50
          hover:bg-zinc-900/90
          hover:text-cyan-100
          ${
            open
              ? "opacity-100 scale-100 pointer-events-auto border-cyan-300/60 text-cyan-100"
              : ""
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

          {isAdmin && (
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
          )}

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
        </motion.div>
      )}

      {refreshOpen && (
        <RefreshModal
          open={refreshOpen}
          title="Refresh Game Data"
          itemName={game?.name}
          onClose={() => setRefreshOpen(false)}
          onConfirm={handleRefresh}
        />
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

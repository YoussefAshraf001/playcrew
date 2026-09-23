"use client";

import { useState, useRef, useEffect, useId } from "react";
import { MdMoreHoriz, MdEdit, MdDelete, MdRefresh } from "react-icons/md";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { deleteDoc, doc } from "firebase/firestore";
import toast from "react-hot-toast";

import RefreshModal, { type RefreshField } from "./RefreshModal";
import { db } from "@/app/lib/firebase";
import {
  getBlockedRefreshFields,
  refreshGameData,
} from "../utils/refreshGame";
import { useUser } from "../context/UserContext";

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
  const { user } = useUser();

  const [open, setOpen] = useState(false);
  const [refreshOpen, setRefreshOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (isHovered === false) setOpen(false);
  }, [isHovered]);

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
        if (dropdownRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
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
    if (refreshOpen) {
      setOpen(false);
    }
  }, [refreshOpen]);

  const handleRefresh = async (fields: Record<RefreshField, boolean>) => {
    if (!user) return false;

    const configuredBlockedFields = getBlockedRefreshFields(game);
    const blockedFields = new Set(
      Object.entries(fields)
        .filter(
          ([field, enabled]) =>
            enabled && configuredBlockedFields.has(field as RefreshField),
        )
        .map(([field]) => field as RefreshField),
    );

    let overrideBlockedFields = false;
    if (blockedFields.size) {
      const blockedLabels = Array.from(blockedFields).map((field) =>
        field === "released"
          ? "release date"
          : field === "cover"
            ? "cover"
            : field,
      );
      const shouldOverride = await new Promise<boolean>((resolve) => {
        toast.custom(
          (notification) => (
            <div className="w-[min(92vw,420px)] rounded-xl border border-amber-300/35 bg-zinc-950 p-4 text-white shadow-2xl">
              <p className="font-semibold text-amber-100">
                {game.name} is set to block refresh
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-300">
                Blocked: {blockedLabels.join(", ")}. Do you want to override
                the protection and refresh once?
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    toast.dismiss(notification.id);
                    resolve(false);
                  }}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toast.dismiss(notification.id);
                    resolve(true);
                  }}
                  className="rounded-lg border border-amber-300/40 bg-amber-400 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-300"
                >
                  Yes, refresh once
                </button>
              </div>
            </div>
          ),
          { id: `refresh-override-${game._docId ?? game.igdb.id}`, duration: Infinity },
        );
      });

      if (!shouldOverride) return false;
      overrideBlockedFields = true;
    }

    try {
      await refreshGameData(
        user.uid,
        game,
        fields,
        game._docId ?? game.igdb.id.toString(),
        { overrideBlockedFields },
      );

      toast.success(
        <span>
          <span className="font-bold pr-1">{game.name}</span>
          <span className="text-black"> was refreshed</span>
        </span>,
      );
      setRefreshOpen(false);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
      return false;
    }
  };

  const actionBtnClass =
    "group/action flex h-10 w-full items-center gap-3 whitespace-nowrap rounded-lg px-3 text-left text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:bg-white/10";

  return (
    <div className="pointer-events-none relative h-full w-full text-sm" ref={dropdownRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        aria-label={`Actions for ${game.name ?? "game"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`pointer-events-auto absolute right-2 top-2 z-50 inline-flex h-9 w-9 items-center justify-center rounded-xl border text-zinc-100 shadow-lg backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${open ? "border-cyan-300/60 bg-zinc-900 shadow-cyan-500/15" : "border-white/25 bg-zinc-950/75 hover:border-white/50 hover:bg-zinc-800"}`}
      >
        <MdMoreHoriz size={22} />
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Actions for ${game.name ?? "game"}`}
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98, y: reduceMotion ? 0 : -4 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => {
            if (open && document.activeElement === triggerRef.current) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
          }}
          onKeyDown={(event) => {
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
              items[next]?.focus();
            }
          }}
          className="pointer-events-auto absolute inset-x-2 top-12 z-50 max-h-[calc(100%-3.5rem)] origin-top-right overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-white/15 bg-zinc-950/95 p-1.5 backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button" role="menuitem" tabIndex={-1}
            onClick={() => {
              setRefreshOpen(true);
              setOpen(false);
            }}
            className={`${actionBtnClass} text-zinc-100 hover:bg-white/10`}
          >
            <MdRefresh size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />
            <span>Refresh details</span>
          </button>

          <button
            type="button" role="menuitem" tabIndex={-1}
            onClick={() => {
              openEditModal(game);
              setOpen(false);
            }}
            className={`${actionBtnClass} text-zinc-100 hover:bg-white/10`}
          >
            <MdEdit size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />
            <span>Edit game</span>
          </button>

          <div role="separator" className="mx-3 my-1 h-px bg-white/10" />

          <button
            type="button" role="menuitem" tabIndex={-1}
            disabled={!user}
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
            <MdDelete size={16} className="shrink-0 text-red-300" aria-hidden="true" />
            <span>Remove game</span>
          </button>
        </motion.div>
      )}
      </AnimatePresence>

      {refreshOpen && (
        <div className="pointer-events-auto">
        <RefreshModal
          open={refreshOpen}
          title="Refresh Game Data"
          itemName={game?.name}
          onClose={() => setRefreshOpen(false)}
          onConfirm={handleRefresh}
        />
        </div>
      )}

    </div>
  );
}

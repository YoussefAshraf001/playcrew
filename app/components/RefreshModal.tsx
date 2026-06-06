"use client";

import { createPortal } from "react-dom";
import { useState } from "react";
import toast from "react-hot-toast";

export type RefreshField =
  | "name"
  | "cover"
  | "genres"
  | "rating"
  | "platforms"
  | "released";

interface Props {
  open: boolean;
  title?: string;
  description?: string;
  itemName?: string | null;
  count?: number | null;
  onClose: () => void;
  onConfirm: (fields: Record<RefreshField, boolean>) => Promise<void> | void;
}

const refreshKeys: RefreshField[] = [
  "name",
  "cover",
  "genres",
  "rating",
  "platforms",
  "released",
];

export default function RefreshModal({
  open,
  title = "Refresh",
  description,
  itemName = null,
  count = null,
  onClose,
  onConfirm,
}: Props) {
  const [fields, setFields] = useState<Record<RefreshField, boolean>>({
    name: false,
    cover: false,
    genres: false,
    rating: false,
    platforms: false,
    released: false,
  });

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

  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    if (selectedCount === 0) return;
    try {
      setProcessing(true);
      await onConfirm(fields);
      toast.success("Refresh queued");
      onClose();
      resetFields();
    } catch (err) {
      toast.error("Refresh failed");
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-md sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
          IGDB Sync
        </p>
        <h2 className="mt-1 text-lg font-bold text-white">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-zinc-300">{description}</p>
        ) : (
          <p className="mt-1 text-xs text-zinc-300">
            {itemName ? (
              <span>
                Choose fields to update for{" "}
                <span className="font-semibold">{itemName}</span>.
              </span>
            ) : (
              <span>
                Choose fields to update
                {count ? (
                  <span>
                    {" "}
                    for <span className="font-semibold">{count}</span> item(s)
                  </span>
                ) : null}
                .
              </span>
            )}
          </p>
        )}

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
          <p className="text-[11px] text-zinc-400">{selectedCount} selected</p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => {
              onClose();
              resetFields();
            }}
            className="rounded-lg border border-white/15 bg-black/40 px-4 py-2 text-sm text-zinc-100 transition hover:bg-white/10"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            disabled={processing || selectedCount === 0}
            className="inline-flex h-10 min-w-28 items-center justify-center rounded-lg bg-linear-to-r from-cyan-200 to-cyan-400 px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {processing ? (
              <span className="loading loading-dots loading-md" />
            ) : (
              "Refresh"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { useEffect, useMemo, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { motion } from "framer-motion";
import {
  FiCheck,
  FiMinus,
  FiPlus,
  FiRotateCcw,
  FiX,
  FiZoomIn,
} from "react-icons/fi";

export default function CropModal({
  file,
  image,
  crop,
  zoom,
  setCrop,
  setZoom,
  aspect,
  onComplete,
  onSave,
  onCancel,
}: {
  file?: File;
  image?: string;
  crop: { x: number; y: number };
  zoom: number;
  setCrop: (v: { x: number; y: number }) => void;
  setZoom: (v: number) => void;
  aspect: number;
  onComplete: (area: Area) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const objectUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  const source = image ?? objectUrl;
  const [saving, setSaving] = useState(false);
  const isAvatar = aspect === 1;
  const zoomPercentage = Math.round(zoom * 100);

  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, saving]);

  const updateZoom = (nextZoom: number) =>
    setZoom(Math.max(1, Math.min(3, Number(nextZoom.toFixed(2)))));

  const resetCrop = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  if (!source) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-modal-title"
        className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/12 bg-[#071017]/98 shadow-[0_32px_100px_rgba(0,0,0,0.72),0_0_0_1px_rgba(34,211,238,0.06)]"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#22d3ee] shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#67e8f9]">
                Image editor
              </p>
            </div>
            <div className="flex items-center gap-2">
              <h2
                id="crop-modal-title"
                className="text-xl font-black text-white sm:text-2xl"
              >
                Crop {isAvatar ? "avatar" : "wallpaper"}
              </h2>
              <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 font-mono text-[10px] font-bold text-white/45">
                {isAvatar ? "1:1" : "16:9"}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/45">
              Drag the image to choose exactly what will be visible.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close crop editor"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-white/55 transition hover:border-white/25 hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <FiX size={19} />
          </button>
        </header>

        <div className="p-3 sm:p-5">
          <div className="relative overflow-hidden rounded-[20px] border border-white/12 bg-black/55 shadow-inner">
            <div className="relative h-[min(54vh,440px)] min-h-[280px]">
              <Cropper
                image={source}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, area) => onComplete(area)}
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white/75">
                <FiZoomIn className="text-[#67e8f9]" /> Zoom
              </div>
              <div className="flex items-center gap-2">
                <span className="min-w-14 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-center font-mono text-[11px] font-bold tabular-nums text-white/65">
                  {zoomPercentage}%
                </span>
                <button
                  type="button"
                  onClick={resetCrop}
                  disabled={zoom === 1 && crop.x === 0 && crop.y === 0}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-white/45 transition hover:bg-white/8 hover:text-white disabled:cursor-default disabled:opacity-25"
                >
                  <FiRotateCcw /> Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-3">
              <button
                type="button"
                onClick={() => updateZoom(zoom - 0.1)}
                disabled={zoom <= 1}
                aria-label="Zoom out"
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/20 text-white/60 transition hover:border-[#22d3ee]/35 hover:text-[#67e8f9] disabled:cursor-not-allowed disabled:opacity-25"
              >
                <FiMinus />
              </button>
              <input
                aria-label="Crop zoom"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#22d3ee]"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => updateZoom(Number(event.target.value))}
              />
              <button
                type="button"
                onClick={() => updateZoom(zoom + 0.1)}
                disabled={zoom >= 3}
                aria-label="Zoom in"
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/20 text-white/60 transition hover:border-[#22d3ee]/35 hover:text-[#67e8f9] disabled:cursor-not-allowed disabled:opacity-25"
              >
                <FiPlus />
              </button>
            </div>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-white/10 bg-black/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-center text-[10px] text-white/35 sm:text-left">
            Press Esc or click outside to cancel
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="h-10 flex-1 rounded-xl border border-white/12 bg-white/[0.035] px-5 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-40 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#67e8f9]/50 bg-[#22d3ee] px-5 text-sm font-black text-black shadow-[0_0_20px_rgba(34,211,238,0.18)] transition hover:bg-[#67e8f9] disabled:cursor-wait disabled:opacity-60 sm:flex-none"
            >
              {saving ? (
                <>
                  <span className="loading loading-spinner loading-xs" /> Saving
                </>
              ) : (
                <>
                  <FiCheck /> Apply crop
                </>
              )}
            </button>
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}

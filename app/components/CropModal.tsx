import { useEffect, useMemo } from "react";
import Cropper, { Area } from "react-easy-crop";
import { motion } from "framer-motion";

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
  onSave: () => void;
  onCancel: () => void;
}) {
  const objectUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  const source = image ?? objectUrl;

  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );

  if (!source) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-2xl space-y-4 rounded-2xl border border-cyan-300/25 bg-slate-900/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
      >
        <div className="relative h-80 overflow-hidden rounded-xl border border-cyan-300/20">
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
        <input
          className="w-full accent-cyan-300"
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onSave}
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-300"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

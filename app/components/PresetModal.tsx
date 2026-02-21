import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { IoMdCloudUpload } from "react-icons/io";

type PresetCategory = {
  id: string;
  label: string;
  static: string[];
  gifs: string[];
};

const GRID_HEIGHT = "min-h-[350px]";

export default function PresetModal({
  type,
  onSelectFile,
  onSelectPreset,
  onClose,
}: {
  type: "avatar" | "wallpaper";
  onSelectFile: (file: File) => void;
  onSelectPreset: (url: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [presets, setPresets] = useState<PresetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<PresetCategory | null>(null);
  const [tab, setTab] = useState<"static" | "gifs">("gifs");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;

    const loadPresets = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/presets?type=${type}`);
        const data = (await res.json()) as PresetCategory[];
        if (!active) return;

        const normalized = Array.isArray(data) ? data : [];
        setPresets(normalized);

        const nextCategory = normalized[0] ?? null;
        setCategory(nextCategory);
        setTab(nextCategory?.gifs?.length ? "gifs" : "static");
        setPage(0);
      } catch {
        if (!active) return;
        setPresets([]);
        setCategory(null);
        setTab("static");
        setPage(0);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPresets();
    return () => {
      active = false;
    };
  }, [type]);

  useEffect(() => {
    setPage(0);
  }, [category, tab]);

  const SLOTS = type === "avatar" ? 6 : 3;
  const assets = category ? category[tab] : [];
  const totalPages = Math.max(1, Math.ceil(assets.length / SLOTS));
  const pageAssets = assets.slice(page * SLOTS, (page + 1) * SLOTS);

  const isWallpaper = type === "wallpaper";
  const GRID_COLS = isWallpaper ? "grid-cols-1" : "grid-cols-3";
  const TILE_ASPECT = isWallpaper ? "aspect-video" : "aspect-square";

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="
    bg-slate-900 rounded-2xl p-6
    w-full max-w-lg
    max-h-[80vh]
    flex flex-col
    overflow-hidden
    space-y-4
  "
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
      >
        <div className="shrink-0 space-y-3">
          <h2 className="text-white text-center font-semibold text-lg">
            Choose your {type}
            <hr className="border-slate-700 mt-2" />
          </h2>

          <div className="flex justify-center gap-2 overflow-x-auto pb-1">
            {presets.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategory(cat);
                  setTab(cat.gifs?.length ? "gifs" : "static");
                }}
                className={`px-3 py-1 rounded-lg text-sm transition ${
                  category?.id === cat.id
                    ? "bg-cyan-500 text-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {category && category.gifs.length > 0 && category.static.length > 0 && (
            <div className="flex justify-center gap-2">
              {(["gifs", "static"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 rounded-full ${
                    tab === t
                      ? "bg-cyan-500 text-black"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                className={`flex items-center justify-center ${GRID_HEIGHT}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-slate-400 text-sm">Loading presets...</p>
              </motion.div>
            ) : !category || assets.length === 0 ? (
              <motion.div
                key="empty"
                className={`flex items-center justify-center ${GRID_HEIGHT}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-slate-400 text-sm">No presets found.</p>
              </motion.div>
            ) : (
              <motion.div
                key={`${category.id}-${tab}-${page}`}
                className={`grid ${GRID_COLS} gap-3 ${GRID_HEIGHT}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                {pageAssets.map((url) => (
                  <button
                    key={url}
                    onClick={() => onSelectPreset(url)}
                    className={`
              relative overflow-hidden rounded-lg
              border border-slate-700
              hover:border-cyan-400
              ${TILE_ASPECT}
              w-full
            `}
                  >
                    <img
                      src={url}
                      className="w-full h-full object-cover"
                      draggable={false}
                      alt=""
                    />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-5 mt-3">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="
      px-4 py-1.5 rounded-full text-sm font-medium
      transition-all duration-200
      flex items-center gap-1
      disabled:cursor-not-allowed

      bg-slate-800 text-slate-300
      hover:bg-cyan-500 hover:text-black hover:-translate-y-0.5

      disabled:bg-slate-900
      disabled:text-slate-600
      disabled:hover:bg-slate-900
      disabled:hover:translate-y-0
    "
          >
            ← Prev
          </button>

          <span className="text-xs text-slate-400 tracking-wide">
            {page + 1} <span className="opacity-60">/</span> {totalPages}
          </span>

          <button
            disabled={page === totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="
      px-4 py-1.5 rounded-full text-sm font-medium
      transition-all duration-200
      flex items-center gap-1
      disabled:cursor-not-allowed

      bg-slate-800 text-slate-300
      hover:bg-cyan-500 hover:text-black hover:-translate-y-0.5

      disabled:bg-slate-900
      disabled:text-slate-600
      disabled:hover:bg-slate-900
      disabled:hover:translate-y-0
    "
          >
            Next →
          </button>
        </div>

        <button
          onClick={() => inputRef.current?.click()}
          className="w-full mt-4 py-2 rounded bg-cyan-500 text-black font-medium flex items-center justify-center gap-2 hover:bg-cyan-600 hover:-translate-y-1 transition-all cursor-pointer"
        >
          <IoMdCloudUpload size={20} />
          Upload your own
        </button>

        <button
          onClick={onClose}
          className="w-[50px] mx-auto text-sm text-slate-400 hover:-translate-y-0.5 transition-all cursor-pointer hover:text-red-600"
        >
          Cancel
        </button>

        <input
          ref={inputRef}
          type="file"
          hidden
          accept="image/*"
          onChange={(e) => e.target.files && onSelectFile(e.target.files[0])}
        />
      </motion.div>
    </motion.div>
  );
}


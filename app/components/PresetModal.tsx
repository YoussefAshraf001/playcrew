import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { IoMdCloudUpload } from "react-icons/io";

type PresetCategory = {
  id: string;
  label: string;
  static: string[];
  gifs: string[];
};

export const AVATAR_PRESETS: PresetCategory[] = [
  {
    id: "harry-potter",
    label: "Harry Potter",
    static: [
      "/presets/Harry-Potter/avatar/static/1.jpg",
      "/presets/Harry-Potter/avatar/static/2.jpg",
      "/presets/Harry-Potter/avatar/static/3.jpg",
      "/presets/Harry-Potter/avatar/static/4.jpg",
    ],
    gifs: [
      "/presets/Harry-Potter/avatar/gif/1.gif",
      "/presets/Harry-Potter/avatar/gif/2.gif",
      "/presets/Harry-Potter/avatar/gif/3.gif",
      "/presets/Harry-Potter/avatar/gif/4.gif",
    ],
  },
  {
    id: "jujutsu-kaisen",
    label: "Jujutsu Kaisen",
    static: [
      "/presets/Jujutsu-Kaisen/avatar/static/1.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/2.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/3.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/4.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/5.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/6.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/7.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/8.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/9.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/10.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/11.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/12.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/13.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/14.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/15.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/16.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/17.jpg",
      "/presets/Jujutsu-Kaisen/avatar/static/18.jpg",
    ],
    gifs: [
      "/presets/Jujutsu-Kaisen/avatar/gif/1.gif",
      "/presets/Jujutsu-Kaisen/avatar/gif/2.gif",
      "/presets/Jujutsu-Kaisen/avatar/gif/3.gif",
      "/presets/Jujutsu-Kaisen/avatar/gif/4.gif",
      "/presets/Jujutsu-Kaisen/avatar/gif/5.gif",
      "/presets/Jujutsu-Kaisen/avatar/gif/6.gif",
      "/presets/Jujutsu-Kaisen/avatar/gif/7.gif",
      "/presets/Jujutsu-Kaisen/avatar/gif/8.gif",
      "/presets/Jujutsu-Kaisen/avatar/gif/9.gif",
      "/presets/Jujutsu-Kaisen/avatar/gif/10.gif",
    ],
  },
  {
    id: "gaming",
    label: "Gaming",
    static: ["/presets/gaming/1.jpg", "/presets/gaming/2.jpg"],
    gifs: ["/presets/gaming/1.gif", "/presets/gaming/2.gif"],
  },
  {
    id: "tv",
    label: "TV & Movies",
    static: ["/presets/tv/1.jpg", "/presets/tv/2.jpg"],
    gifs: ["/presets/tv/1.gif", "/presets/tv/2.gif"],
  },
];

export const WALLPAPER_PRESETS: PresetCategory[] = [
  {
    id: "harry-potter",
    label: "Harry Potter",
    static: [
      "/presets/Harry-Potter/wallpaper/static/1.jpg",
      "/presets/Harry-Potter/wallpaper/static/2.jpg",
      "/presets/Harry-Potter/wallpaper/static/3.jpg",
      "/presets/Harry-Potter/wallpaper/static/4.jpg",
      "/presets/Harry-Potter/wallpaper/static/5.jpg",
      "/presets/Harry-Potter/wallpaper/static/6.jpg",
      "/presets/Harry-Potter/wallpaper/static/7.jpg",
    ],
    gifs: [
      "/presets/Harry-Potter/wallpaper/gif/1.gif",
      "/presets/Harry-Potter/wallpaper/gif/2.gif",
    ],
  },
  {
    id: "jujutsu-kaisen",
    label: "Jujutsu Kaisen",
    static: [
      "/presets/Jujutsu-Kaisen/wallpaper/static/1.jpg",
      "/presets/Jujutsu-Kaisen/wallpaper/static/2.jpg",
      "/presets/Jujutsu-Kaisen/wallpaper/static/3.jpg",
    ],
    gifs: [
      "/presets/Jujutsu-Kaisen/wallpaper/gif/1.gif",
      "/presets/Jujutsu-Kaisen/wallpaper/gif/2.gif",
      "/presets/Jujutsu-Kaisen/wallpaper/gif/3.gif",
    ],
  },
];

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
  const [category, setCategory] = useState<PresetCategory | null>(null);
  const [tab, setTab] = useState<"static" | "gifs">("gifs");
  const [page, setPage] = useState(0);

  const PRESETS: Record<"avatar" | "wallpaper", PresetCategory[]> = {
    avatar: AVATAR_PRESETS,
    wallpaper: WALLPAPER_PRESETS,
  };
  const presets = PRESETS[type];

  const SLOTS = presets === AVATAR_PRESETS ? 6 : 3;

  const assets = category ? category[tab] : [];
  const totalPages = Math.max(1, Math.ceil(assets.length / SLOTS));
  const pageAssets = assets.slice(page * SLOTS, (page + 1) * SLOTS);

  const isWallpaper = type === "wallpaper";
  const GRID_COLS = isWallpaper ? "grid-cols-1" : "grid-cols-3";
  const TILE_ASPECT = isWallpaper ? "aspect-video" : "aspect-square";

  const LIVE_CATEGORY_IDS = ["harry-potter", "jujutsu-kaisen"];
  const isComingSoon = category && !LIVE_CATEGORY_IDS.includes(category.id);

  useEffect(() => {
    if (!category && presets.length > 0) {
      setCategory(presets[0]); // default category
      setTab("gifs"); // or "static" if you prefer
    }
  }, [presets, category]);

  useEffect(() => {
    setPage(0);
  }, [category, tab]);

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

          {/* CATEGORY SELECT */}
          <div className="flex justify-center gap-2 overflow-x-auto pb-1">
            {presets.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategory(cat);
                  setTab("gifs");
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

          {/* STATIC / GIF TOGGLE */}
          {category && !isComingSoon && (
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

          {/* {category && (
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
          )} */}
        </div>

        {/* PREVIEW GRID */}
        <div className="flex-1 overflow-y-auto pr-1">
          <AnimatePresence mode="wait">
            {isComingSoon ? (
              <motion.div
                key="coming-soon"
                className={`flex flex-col items-center justify-center ${GRID_HEIGHT} text-center`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-2xl font-semibold text-cyan-400 mb-2">
                  Coming Soon
                </p>
                <p className="text-sm text-slate-400 max-w-xs">
                  Presets for{" "}
                  <span className="text-slate-200">{category?.label}</span> are
                  on the way.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`${category?.id}-${tab}-${page}`}
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
                    />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* <div className="flex-1 overflow-y-auto pr-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${category?.id}-${tab}-${page}`}
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
                  />
                </button>
              ))}
            </motion.div>
          </AnimatePresence>
        </div> */}

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

        {/* UPLOAD */}
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

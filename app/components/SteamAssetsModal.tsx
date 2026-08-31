"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FiCheck, FiExternalLink, FiImage, FiX } from "react-icons/fi";

export type SteamAsset = {
  key: string;
  label: string;
  filename: string;
  dimensions?: string;
  url: string;
};

type ResponseData = {
  appId: string;
  steamUrl: string;
  assets: SteamAsset[];
  error?: string;
};

const assetUrlsMatch = (first?: string, second?: string) => {
  if (!first || !second) return false;
  try {
    return new URL(first).pathname === new URL(second).pathname;
  } catch {
    return first.split("?")[0] === second.split("?")[0];
  }
};

function SteamArtworkPreview({ src, alt }: { src: string; alt: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-700 to-zinc-900 transition-opacity duration-500 ${
          ready || failed ? "opacity-0" : "animate-pulse opacity-100"
        }`}
      />
      {failed && (
        <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-zinc-500">
          Artwork could not be loaded
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={async (event) => {
          try {
            await event.currentTarget.decode();
          } catch {
            // The load event is sufficient when explicit decoding is unavailable.
          }
          setReady(true);
        }}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover opacity-0 transition-all duration-700 ease-out group-hover:scale-[1.02] ${
          ready ? "opacity-100" : ""
        }`}
      />
    </div>
  );
}

export default function SteamAssetsModal({
  open,
  igdbId,
  gameName,
  currentCoverUrl,
  onClose,
  onUseAsset,
}: {
  open: boolean;
  igdbId: number;
  gameName: string;
  currentCoverUrl?: string;
  onClose: () => void;
  onUseAsset: (asset: SteamAsset) => Promise<void> | void;
}) {
  const [data, setData] = useState<ResponseData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SteamAsset | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError("");
      setData(null);
      setSelected(null);
    });

    fetch(`/api/igdb/${igdbId}/steam-assets?assetSet=library-capsules-v3`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as ResponseData;
        if (!response.ok) throw new Error(payload.error || "Could not load Steam assets.");
        setData(payload);
        setSelected(
          payload.assets.find((asset) =>
            assetUrlsMatch(asset.url, currentCoverUrl),
          ) ?? null,
        );
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Could not load Steam assets.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentCoverUrl, igdbId, open]);

  const apply = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await onUseAsset(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/85 p-3 backdrop-blur-lg sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/12 bg-zinc-950 shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Steam artwork</p>
                <h2 className="mt-1 text-2xl font-black text-white">{gameName}</h2>
                {data && <p className="mt-1 text-sm text-zinc-400">Steam App ID {data.appId} · {data.assets.length} assets found</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close Steam assets" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white"><FiX /></button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
              {loading ? (
                <div className="grid min-h-72 place-items-center text-center"><div><span className="loading loading-spinner loading-lg text-cyan-300" /><p className="mt-3 text-sm text-zinc-400">Resolving Steam ID and checking artwork…</p></div></div>
              ) : error ? (
                <div className="grid min-h-72 place-items-center text-center"><div className="max-w-md"><FiImage className="mx-auto text-4xl text-zinc-600" /><h3 className="mt-4 text-xl font-bold text-white">No Steam artwork available</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{error}</p></div></div>
              ) : data?.assets.length ? (
                <div>
                  <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.025] p-5">
                    <p className="mb-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                      Cover preview
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-7">
                      <div className="w-32 sm:w-40">
                        <p className="mb-2 text-center text-xs font-semibold text-zinc-500">Before</p>
                        <div className="overflow-hidden rounded-xl border border-white/10 shadow-xl">
                          <SteamArtworkPreview
                            key={currentCoverUrl || "placeholder-cover"}
                            src={currentCoverUrl || "/placeholder-game.jpg"}
                            alt={`${gameName} current cover`}
                          />
                        </div>
                      </div>
                      <div className="text-2xl font-black text-cyan-300">→</div>
                      <div className="w-32 sm:w-40">
                        <p className="mb-2 text-center text-xs font-semibold text-zinc-500">After</p>
                        <div className="overflow-hidden rounded-xl border border-cyan-300/25 bg-zinc-900 shadow-xl">
                          {selected ? (
                            <SteamArtworkPreview
                              key={selected.url}
                              src={selected.url}
                              alt={`${gameName} selected cover`}
                            />
                          ) : (
                            <div className="grid aspect-[2/3] place-items-center px-3 text-center text-xs text-zinc-500">
                              Select a capsule below
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="flex flex-wrap justify-center gap-5">
                    {data.assets.map((asset) => {
                      const isCurrentCover = assetUrlsMatch(
                        asset.url,
                        currentCoverUrl,
                      );
                      return (
                        <button key={asset.key} type="button" onClick={() => setSelected(asset)} className={`group relative w-full max-w-[225px] basis-[225px] overflow-hidden rounded-2xl border text-left transition ${selected?.key === asset.key ? "border-cyan-300 bg-cyan-500/10 ring-2 ring-cyan-400/25" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
                          {isCurrentCover && (
                            <span className="absolute right-2 top-2 z-10 rounded-full border border-cyan-200/35 bg-cyan-950/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-cyan-200 shadow-lg backdrop-blur-md">
                              Current cover
                            </span>
                          )}
                          <SteamArtworkPreview key={asset.url} src={asset.url} alt={asset.label} />
                          <div className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="font-bold text-white">{asset.label}</p><p className="mt-0.5 text-xs text-zinc-500">{asset.dimensions ?? asset.filename}</p></div>{selected?.key === asset.key && <FiCheck className="shrink-0 text-cyan-300" />}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid min-h-72 place-items-center text-zinc-400">Steam ID found, but no supported artwork files were available.</div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/25 px-5 py-4 sm:px-7">
              {data ? <a href={data.steamUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><FiExternalLink /> Open Steam page</a> : <span />}
              <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/5">Cancel</button><button type="button" disabled={!selected || saving} onClick={apply} className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-black text-zinc-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Applying…" : "Use as cover"}</button></div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

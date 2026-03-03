"use client";

import { useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import toast from "react-hot-toast";

import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";

type Candidate = {
  id: string;
  name: string;
  oldUrl: string;
  newUrl: string;
};

const toBetterCoverUrl = (url: string) => {
  if (!url.includes("igdb.com")) return url;
  if (url.includes("/t_cover_big_2x/")) return url;
  if (/\/t_[^/]+\//.test(url)) {
    return url.replace(/\/t_[^/]+\//, "/t_cover_big_2x/");
  }
  return url.replace("t_thumb", "t_cover_big_2x");
};

export default function DivPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  const previewItems = useMemo(() => candidates.slice(0, 10), [candidates]);

  const scan = async () => {
    if (!user) {
      toast.error("You must be logged in.");
      return;
    }
    setLoading(true);
    setDoneCount(0);
    try {
      const colRef = collection(db, "users", user.uid, "games_igdb");
      const snap = await getDocs(colRef);

      const next: Candidate[] = [];
      snap.docs.forEach((d) => {
        const data = d.data() as {
          name?: string;
          igdb?: { cover?: string };
        };
        const oldUrl = data?.igdb?.cover;
        if (!oldUrl || typeof oldUrl !== "string") return;

        const newUrl = toBetterCoverUrl(oldUrl);
        if (newUrl !== oldUrl) {
          next.push({
            id: d.id,
            name: data?.name ?? "Unknown game",
            oldUrl,
            newUrl,
          });
        }
      });

      setCandidates(next);
      if (!next.length) toast.success("No covers need migration.");
      else toast.success(`Found ${next.length} cover URLs to upgrade.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to scan games.");
    } finally {
      setLoading(false);
    }
  };

  const runMigration = async () => {
    if (!user || !candidates.length || running) return;
    setRunning(true);
    try {
      const CHUNK = 350;
      let updated = 0;

      for (let i = 0; i < candidates.length; i += CHUNK) {
        const chunk = candidates.slice(i, i + CHUNK);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
          const ref = doc(db, "users", user.uid, "games_igdb", item.id);
          batch.update(ref, {
            "igdb.cover": item.newUrl,
            lastUpdated: serverTimestamp(),
          });
        });

        await batch.commit();
        updated += chunk.length;
        setDoneCount(updated);
      }

      toast.success(`Updated ${updated} game covers.`);
      setCandidates([]);
    } catch (err) {
      console.error(err);
      toast.error("Migration failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="min-h-screen bg-black px-4 pb-8 pt-24 text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl rounded-2xl border border-cyan-500/25 bg-zinc-950/70 p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300/80">
          Cover Migration
        </p>
        <h1 className="mt-1 text-2xl font-bold">/div</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Upgrade stored IGDB covers to <code>t_cover_big_2x</code> for better
          quality while remaining performance-friendly.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={scan}
            disabled={loading || running}
            className="rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-50"
          >
            {loading ? "Scanning..." : "Scan My Games"}
          </button>
          <button
            type="button"
            onClick={runMigration}
            disabled={!candidates.length || loading || running}
            className="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {running
              ? `Updating... ${doneCount}/${candidates.length}`
              : `Run Migration (${candidates.length})`}
          </button>
        </div>

        {!!previewItems.length && (
          <div className="mt-5 rounded-xl border border-white/10 bg-black/35 p-3">
            <p className="mb-2 text-xs font-semibold text-zinc-200">
              Preview (first {previewItems.length})
            </p>
            <div className="space-y-2">
              {previewItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-white/10 bg-zinc-900/60 p-2"
                >
                  <p className="truncate text-sm font-semibold text-white">
                    {item.name}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-zinc-400">
                    OLD: {item.oldUrl}
                  </p>
                  <p className="truncate text-[11px] text-cyan-200">
                    NEW: {item.newUrl}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}


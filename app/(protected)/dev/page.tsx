"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";

type GameDoc = {
  id: string; // docId
  [key: string]: any;
};

export default function DebugSearchPage() {
  const { user } = useUser();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameDoc[]>([]);
  const [selected, setSelected] = useState<GameDoc | null>(null);
  const [json, setJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [renamingId, setRenamingId] = useState("");

  /* ---------------- SEARCH ---------------- */

  const search = async () => {
    if (!user || !query.trim()) return;

    setLoading(true);
    setResults([]);
    setSelected(null);

    const snap = await getDocs(collection(db, "users", user.uid, "games_igdb"));

    const q = query.toLowerCase();
    const matches: GameDoc[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;

      const name = data?.name?.toLowerCase?.() || "";
      const igdbName = data?.igdb?.name?.toLowerCase?.() || "";
      const igdbId = String(data?.igdb?.id ?? "");

      if (
        id.includes(q) ||
        name.includes(q) ||
        igdbName.includes(q) ||
        igdbId === q
      ) {
        matches.push({
          id,
          ...data,
        });
      }
    });

    setResults(matches);
    setLoading(false);
  };

  /* ---------------- SAVE ---------------- */

  const saveChanges = async () => {
    if (!user || !selected) return;

    try {
      const parsed = JSON.parse(json);

      await setDoc(
        doc(db, "users", user.uid, "games_igdb", selected.id),
        parsed,
        { merge: false },
      );

      alert("✅ Saved");
    } catch (e) {
      alert("❌ Invalid JSON");
    }
  };

  /* ---------------- RENAME DOC ID ---------------- */

  const renameDoc = async () => {
    if (!user || !selected || !renamingId) return;

    const oldRef = doc(db, "users", user.uid, "games_igdb", selected.id);
    const newRef = doc(db, "users", user.uid, "games_igdb", renamingId);

    const snap = await getDoc(newRef);
    if (snap.exists()) {
      alert("❌ That ID already exists");
      return;
    }

    await setDoc(newRef, {
      ...selected,
      igdb: {
        ...selected.igdb,
        id: Number(renamingId),
      },
    });

    await deleteDoc(oldRef);

    alert("✅ Doc ID updated");

    setSelected(null);
    setResults([]);
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-black text-white p-8 space-y-6 mt-15">
      <h1 className="text-3xl font-bold">🔍 Firestore Debug Search</h1>

      {/* Search */}
      <div className="flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by doc ID, name, igdb.id..."
          className="flex-1 px-4 py-2 bg-zinc-900 rounded-lg"
        />
        <button
          onClick={search}
          className="px-5 py-2 bg-cyan-500 text-black font-semibold rounded-lg"
        >
          Search
        </button>
      </div>

      {loading && <div>Searching...</div>}

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((g) => (
          <div
            key={g.id}
            onClick={() => {
              setSelected(g);
              setJson(JSON.stringify(g, null, 2));
              setRenamingId(g.id);
            }}
            className="p-4 bg-zinc-900 border border-zinc-700 rounded cursor-pointer hover:bg-zinc-800"
          >
            <div className="font-semibold">{g.name || "Unnamed"}</div>
            <div className="text-xs text-zinc-400">Doc ID: {g.id}</div>
            <div className="text-xs text-zinc-400">
              IGDB ID: {g.igdb?.id ?? "❌"}
            </div>
          </div>
        ))}
      </div>

      {/* Editor */}
      {selected && (
        <div className="mt-6 space-y-4">
          <h2 className="text-xl font-bold">✏ Edit Document</h2>

          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={18}
            className="w-full bg-black border border-zinc-700 rounded p-4 font-mono text-sm"
          />

          <div className="flex gap-3">
            <button
              onClick={saveChanges}
              className="px-4 py-2 bg-green-500 text-black rounded"
            >
              Save Changes
            </button>

            <div className="flex gap-2">
              <input
                value={renamingId}
                onChange={(e) => setRenamingId(e.target.value)}
                className="px-3 py-2 bg-zinc-800 rounded"
                placeholder="New Doc ID"
              />
              <button
                onClick={renameDoc}
                className="px-4 py-2 bg-red-500 text-black rounded"
              >
                Rename ID
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

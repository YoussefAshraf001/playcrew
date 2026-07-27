"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/context/UserContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

const CATEGORIES = [
  "profile",
  "library",
  "reviews",
  "screenshots",
  "activity",
  "friends",
  "wishlist",
  "playtime",
  "search",
] as const;

export default function PrivacySettingsPage() {
  const { user } = useUser();
  const uid = user?.uid;
  const [privacy, setPrivacy] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!uid) {
      setLoading(false);
      return;
    }

    (async () => {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (!mounted) return;
      const data = snap.exists() ? (snap.data() as any) : {};
      setPrivacy(data.privacy ?? {});
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [uid]);

  const save = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      const ref = doc(db, "users", uid);
      await setDoc(ref, { privacy }, { merge: true });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Privacy Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => (
          <div key={cat} className="theme-panel p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="font-semibold capitalize">{cat}</div>
              <select
                value={privacy[cat] ?? "public"}
                onChange={(e) =>
                  setPrivacy((p) => ({ ...p, [cat]: e.target.value }))
                }
                className="rounded-md border px-2 py-1"
              >
                <option value="public">Public</option>
                <option value="friends">Friends Only</option>
                <option value="private">Private</option>
              </select>
            </div>
            <p className="text-sm text-zinc-400 mt-2">
              Control who can see your {cat}.
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl border px-4 py-2"
        >
          Save
        </button>
      </div>
    </main>
  );
}

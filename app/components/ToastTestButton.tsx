"use client";

import toast from "react-hot-toast";

export default function ToastTestButton() {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <button
      type="button"
      onClick={() => {
        toast.success("Toast test: looks good.");
      }}
      className="fixed bottom-4 right-4 z-[1400] rounded-lg border border-cyan-400/40 bg-zinc-900/85 px-3 py-2 text-xs font-semibold text-cyan-200 shadow-[0_10px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm transition hover:bg-zinc-800"
    >
      Test Toast
    </button>
  );
}

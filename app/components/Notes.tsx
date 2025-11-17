"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { FaStar } from "react-icons/fa";

interface NotesModalProps {
  open: boolean;
  initialNotes: string;
  initialRating: number;
  initialProgress: number;
  initialPlaytime: number;
  onClose: () => void;
  onSave: (
    notes: string,
    rating: number,
    progress: number,
    playtime: number
  ) => Promise<void>;
}

export default function NotesModal({
  open,
  initialNotes,
  initialRating,
  initialProgress,
  initialPlaytime,
  onClose,
  onSave,
}: NotesModalProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [rating, setRating] = useState(initialRating);
  const [progress, setProgress] = useState(initialProgress);
  const [playtime, setPlaytime] = useState(initialPlaytime);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (open) {
      setNotes(initialNotes);
      setRating(
        initialRating !== undefined && initialRating !== null
          ? Math.round(initialRating)
          : 0
      );

      setProgress(initialProgress);
      setPlaytime(initialPlaytime);
    }
  }, [open, initialNotes, initialRating, initialProgress, initialPlaytime]);

  // Drag handling for progress bar
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    const bar = document.getElementById("progress-bar");
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const newProgress = Math.round(
      ((e.clientX - rect.left) / rect.width) * 100
    );
    setProgress(Math.max(0, Math.min(100, newProgress)));
  };

  const handleMouseUp = () => setDragging(false);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-gray-900 p-6 rounded-2xl max-w-md w-full shadow-xl border border-white/20"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-xl font-bold mb-4 text-white">Notes</h2>

            {/* Notes textarea */}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 resize-none mb-4"
              rows={4}
              placeholder="Add your personal notes..."
            />

            {/* Rating */}
            <div className="flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <FaStar
                  key={i}
                  size={20}
                  className={`cursor-pointer transition ${
                    i <= rating ? "text-yellow-400" : "text-gray-600"
                  }`}
                  onClick={() => setRating(i)}
                />
              ))}
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <label className="text-white text-sm mb-1 block">
                Progress: {progress}%
              </label>
              <div
                id="progress-bar"
                className="w-full h-4 bg-gray-700 rounded-lg relative cursor-pointer select-none"
                onMouseDown={(e) => setDragging(true)}
                onClick={(e) => {
                  const rect = (
                    e.target as HTMLDivElement
                  ).getBoundingClientRect();
                  const newProgress = Math.round(
                    ((e.clientX - rect.left) / rect.width) * 100
                  );
                  setProgress(Math.max(0, Math.min(100, newProgress)));
                }}
              >
                <div
                  className="h-4 bg-purple-500 rounded-lg transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Playtime input */}
            <div className="mb-4">
              <label className="text-white text-sm mb-1 block">
                Playtime (hours)
              </label>
              <input
                type="number"
                min={0}
                value={playtime}
                onChange={(e) =>
                  setPlaytime(Math.max(0, Number(e.target.value)))
                }
                className="w-full p-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-400 transition"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onSave(notes, rating, progress, playtime);
                    toast.success("Notes saved!");
                    onClose();
                  } catch {
                    toast.error("Failed to save notes.");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition font-semibold"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

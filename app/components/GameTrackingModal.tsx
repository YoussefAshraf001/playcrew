"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaStar, FaHeart } from "react-icons/fa";

interface NotesModalProps {
  open: boolean;
  initialNotes: string;
  initialRating: number;
  initialProgress: number;
  initialPlaytime: number;
  initialStatus: string;
  initialFavorite: boolean;
  showFavorite: boolean;
  showStatus: boolean;
  onClose: () => void;
  onSave: (
    notes: string,
    rating: number,
    progress: number,
    playtime: number,
    status: string,
    favorite: boolean
  ) => Promise<void>;
  saving: boolean;
}

export default function GameTrackingModal({
  open,
  initialNotes,
  initialRating,
  initialProgress,
  initialPlaytime,
  initialStatus,
  initialFavorite,
  showStatus,
  showFavorite,
  onClose,
  onSave,
  saving,
}: NotesModalProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [rating, setRating] = useState(initialRating);
  const [progress, setProgress] = useState(initialProgress);
  const [status, setStatus] = useState(initialStatus);
  const [favorite, setFavorite] = useState(initialFavorite);

  const [hours, setHours] = useState(Math.floor(initialPlaytime));
  const [minutes, setMinutes] = useState(
    Math.round((initialPlaytime % 1) * 60)
  );

  const progressRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNotes(initialNotes);
    setRating(initialRating ?? 0);
    setProgress(initialProgress ?? 0);
    setStatus(initialStatus);
    setFavorite(initialFavorite);
    setHours(Math.floor(initialPlaytime));
    setMinutes(Math.round((initialPlaytime % 1) * 60));
  }, [
    open,
    initialNotes,
    initialRating,
    initialProgress,
    initialPlaytime,
    initialStatus,
    initialFavorite,
  ]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging || !progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const newProgress = Math.round(
        ((e.clientX - rect.left) / rect.width) * 100
      );
      setProgress(Math.max(0, Math.min(100, newProgress)));
    };
    const handleMouseUp = () => setDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  const handleClickProgress = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const newProgress = Math.round(
      ((e.clientX - rect.left) / rect.width) * 100
    );
    setProgress(Math.max(0, Math.min(100, newProgress)));
  };

  const totalPlaytime = hours + minutes / 60;

  useEffect(() => {
    if (!open) return; // only apply when modal is open

    if (status === "Completed") {
      setProgress(100);
    }
  }, [status, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-gray-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-white/20 grid gap-6"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="w-full text-center">
              <h3>Quick Tracker Edit</h3>
            </div>
            {/* Top Section: Status & Favorite */}
            <div className="flex justify-between items-center">
              {showStatus && (
                <select
                  className="bg-gray-800 text-white p-2 rounded-lg border border-gray-700"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="Playing">Playing</option>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Dropped">Dropped</option>
                  <option value="Want To Play">Want To Play</option>
                </select>
              )}

              {showFavorite && (
                <FaHeart
                  size={28}
                  className={`cursor-pointer transition ${
                    favorite ? "text-red-500" : "text-gray-600"
                  }`}
                  onClick={() => setFavorite(!favorite)}
                />
              )}
            </div>

            {/* Middle Section: Notes & Rating */}
            <div className="bg-gray-800 rounded-2xl p-4 grid gap-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Write your notes..."
                className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white resize-none"
              />

              <div className="flex items-center gap-2">
                <span className="text-sm text-white/80">Rating:</span>
                {[1, 2, 3, 4, 5].map((i) => (
                  <FaStar
                    key={i}
                    size={22}
                    className={`cursor-pointer ${
                      i <= rating ? "text-yellow-400" : "text-gray-500"
                    }`}
                    onClick={() => setRating(i)}
                  />
                ))}
              </div>
            </div>

            {/* Bottom Section: Progress & Playtime */}
            <div className="bg-gray-800 rounded-2xl p-4 grid gap-4">
              <div>
                <span className="text-sm text-white/80 mb-1 block">
                  Progress: {progress}%
                </span>
                <div
                  ref={progressRef}
                  className="w-full h-4 bg-gray-700 rounded-lg relative cursor-pointer"
                  onMouseDown={() => setDragging(true)}
                  onClick={handleClickProgress}
                >
                  <div
                    className="h-4 bg-purple-500 rounded-lg transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-white/80">Playtime:</label>
                <input
                  type="number"
                  min={0}
                  value={hours}
                  onChange={(e) =>
                    setHours(Math.max(0, Number(e.target.value)))
                  }
                  className="w-16 p-2 rounded-lg bg-gray-700 border border-gray-600 text-white"
                />
                <span className="text-white/70">hrs</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(
                      Math.max(0, Math.min(59, Number(e.target.value)))
                    )
                  }
                  className="w-16 p-2 rounded-lg bg-gray-700 border border-gray-600 text-white"
                />
                <span className="text-white/70">mins</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-4">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onSave(
                    notes,
                    rating,
                    progress,
                    totalPlaytime,
                    status,
                    favorite
                  );
                  onClose();
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition font-semibold"
                disabled={saving}
              >
                {saving ? (
                  <div className="flex justify-center items-center gap-2 w-full">
                    <span className="loading loading-spinner loading-xs" />
                    Saving
                  </div>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

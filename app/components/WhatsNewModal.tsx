"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaTimes } from "react-icons/fa";

import patchNotes from "../patch-notes.json";
import roadmap from "../roadmap.json";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type RoadmapStatus = "planned" | "in-progress" | "evaluating" | "completed";

type RoadmapItem = {
  title: string;
  status: RoadmapStatus;
  description?: string;
};

type PatchNote = {
  version: string;
  title: string;
  date: string;
  featured?: boolean;
  changes: Array<{
    category: string;
    items: string[];
  }>;
};

type RoadmapSection = {
  section: string;
  items: RoadmapItem[];
};

const statusClass: Record<RoadmapStatus, string> = {
  planned:
    "border-[rgba(var(--theme-accent-rgb),0.15)] bg-[rgba(var(--theme-accent-rgb),0.08)] theme-text-muted",

  evaluating: "theme-surface border theme-text-muted",

  "in-progress":
    "border-[rgba(var(--theme-accent-rgb),0.4)] bg-[rgba(var(--theme-accent-rgb),0.12)] text-[rgb(var(--theme-accent-rgb))] shadow-[0_0_14px_rgba(var(--theme-accent-rgb),0.14)]",

  completed: "border-emerald-400 bg-emerald-500/10 text-emerald-300",
};

const formatStatusLabel = (status: RoadmapStatus) =>
  status
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
export default function WhatsNewModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<"updates" | "roadmap">("updates");

  const patches = [...(patchNotes as PatchNote[])].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0;
  });

  const [selectedVersion, setSelectedVersion] = useState(
    patches[0]?.version ?? "",
  );

  const selectedPatch = patches.find((p) => p.version === selectedVersion);

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="theme-modal-backdrop fixed inset-0 z-[2000] flex items-center justify-center p-4"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{
            duration: 0.3,
            ease: "easeInOut",
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{
              type: "spring",
              stiffness: 220,
              damping: 24,
            }}
            onClick={(e) => e.stopPropagation()}
            className="
              theme-panel
              w-full
              max-w-3xl
              overflow-hidden
              rounded-3xl
              border
              shadow-[0_24px_60px_rgba(0,0,0,0.55)]
              h-[85vh]
              flex
              flex-col
            "
          >
            {/* HEADER */}
            <div className="border-b border-[var(--theme-border)] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="theme-accent-soft-text text-xs font-semibold uppercase tracking-[0.18em]">
                    PlayCrew Hub
                  </p>

                  <h2 className="mt-1 text-2xl font-black theme-text">
                    What's New
                  </h2>

                  <p className="theme-text-muted mt-1 text-sm">
                    Latest updates, roadmap, and future plans.
                  </p>
                </div>

                <button
                  onClick={onClose}
                  className="
                    theme-surface
                    theme-hover-surface
                    flex h-10 w-10 items-center justify-center
                    rounded-xl border
                  "
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* TABS */}
            <div className="border-b border-[var(--theme-border)] p-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setTab("updates")}
                  className={`
                    rounded-xl px-4 py-2 text-sm font-semibold transition
                    ${
                      tab === "updates"
                        ? "theme-accent-soft-bg border"
                        : "theme-surface border"
                    }
                  `}
                >
                  What's New
                </button>

                <button
                  onClick={() => setTab("roadmap")}
                  className={`
                    rounded-xl px-4 py-2 text-sm font-semibold transition
                    ${
                      tab === "roadmap"
                        ? "theme-accent-soft-bg border"
                        : "theme-surface border"
                    }
                  `}
                >
                  Roadmap
                </button>
              </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-3">
              {tab === "updates" && selectedPatch && (
                <div className="space-y-4">
                  <div className="theme-panel-strong rounded-2xl border p-5">
                    <div className="mb-5">
                      <div className="flex items-center gap-2 ">
                        <select
                          value={selectedVersion}
                          onChange={(e) => setSelectedVersion(e.target.value)}
                          className="theme-surface max-w-[180px] rounded-xl border px-4 py-2"
                        >
                          {patches.map((patch) => (
                            <option key={patch.version} value={patch.version}>
                              v{patch.version}
                            </option>
                          ))}
                        </select>

                        {selectedPatch.featured && (
                          <span className="theme-accent-soft-bg theme-accent-text rounded-full border px-2 py-1 text-xs">
                            Featured
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 text-xl font-bold theme-text">
                        {selectedPatch.title}
                      </h3>

                      <p className="theme-text-muted text-sm">
                        {selectedPatch.date}
                      </p>
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selectedVersion}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-5"
                      >
                        {selectedPatch.changes.map((section) => (
                          <div key={section.category}>
                            <h4 className="mb-2 font-semibold theme-text">
                              {section.category}
                            </h4>

                            <ul className="space-y-1">
                              {section.items.map((item) => (
                                <li
                                  key={item}
                                  className="theme-text-muted text-sm"
                                >
                                  • {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {tab === "roadmap" && (
                <div className="space-y-4">
                  {(roadmap as RoadmapSection[]).map((section) => (
                    <div
                      key={section.section}
                      className="theme-panel-strong rounded-2xl border p-5"
                    >
                      <h3 className="mb-4 text-lg font-bold theme-text">
                        {section.section}
                      </h3>

                      <div className="space-y-3">
                        {/* {[...section.items]
                          .sort((a, b) => {
                            const order: Record<RoadmapStatus, number> = {
                              completed: 0,
                              "in-progress": 1,
                              planned: 2,
                              evaluating: 3,
                            };

                            return order[a.status] - order[b.status];
                          })
                          .map((item: RoadmapItem) => ( */}
                        {section.items.map((item: RoadmapItem) => (
                          <div
                            key={item.title}
                            className="theme-surface rounded-xl border p-4"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <h4 className="font-semibold theme-text">
                                {item.title}
                              </h4>

                              <span
                                className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${statusClass[item.status]}`}
                              >
                                {formatStatusLabel(item.status)}
                              </span>
                            </div>

                            {item.description && (
                              <p className="theme-text-muted mt-2 text-sm">
                                {item.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { TbPlaystationCircle, TbPlaystationX } from "react-icons/tb";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title = "ARE YOU SURE?",
  message,
  confirmText = "Confirm",
  cancelText = "Back",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Dimmed background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.65 }}
            exit={{ opacity: 0 }}
            className="theme-modal-backdrop fixed inset-0 z-[10000]"
            onClick={onCancel}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="
              fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
              z-[10001]
              w-[640px] max-w-[92vw]
              theme-panel-strong backdrop-blur-lg
              border
              shadow-[0_0_80px_rgba(0,0,0,0.45)]
            "
          >
            <div className="px-10 pb-8 text-center">
              {/* Title */}
              <h2 className="theme-text relative mb-4 py-4 text-lg uppercase tracking-[0.45em]">
                {title}

                {/* Main etched line */}
                <span className="pointer-events-none absolute bottom-1 left-0 h-px w-full bg-linear-to-r from-transparent via-[rgba(var(--theme-accent-rgb),0.7)] to-transparent" />

                {/* Secondary scratch */}
                <span className="pointer-events-none absolute bottom-1 left-1/4 h-px w-1/2 bg-[rgba(var(--theme-accent-rgb),0.22)] blur-[0.5px]" />
              </h2>

              {/* Message */}
              <p className="theme-text-muted mb-10 text-base leading-relaxed">
                {message}
              </p>

              {/* Actions */}
              <div className="flex justify-center gap-28 text-lg tracking-wide">
                {/* Confirm */}
                <button
                  onClick={onConfirm}
                  className="
      group flex items-center gap-4
      theme-text font-medium
      transition-all duration-200
      hover:opacity-100
    "
                >
                  <TbPlaystationX
                    className="
        text-cyan-400 text-3xl
        transition-transform duration-200
        group-hover:scale-110
      "
                  />
                  <span className="transition-transform duration-200 group-hover:translate-x-1">
                    {confirmText}
                  </span>
                </button>

                {/* Back */}
                <button
                  onClick={onCancel}
                  className="
      group flex items-center gap-4
      theme-text-muted font-medium
      transition-all duration-200
      hover:theme-text
    "
                >
                  <TbPlaystationCircle
                    className="
        text-red-400 text-3xl
        transition-transform duration-200
        group-hover:scale-110
      "
                  />
                  <span className="transition-transform duration-200 group-hover:translate-x-1">
                    {cancelText}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

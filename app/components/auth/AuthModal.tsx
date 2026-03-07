"use client";

import { useEffect } from "react";
import LoginForm from "@/app/components/auth/LoginForm";
import SignupForm from "@/app/components/auth/SignupForm";
import { useAuthModal } from "@/app/context/AuthModalContext";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";

export default function AuthModal() {
  const { mode, close } = useAuthModal();

  useEffect(() => {
    if (!mode) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, close]);

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.25 } }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          onClick={close}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/12 bg-zinc-950/95 p-0 shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
            initial={{ y: 28, scale: 0.96, opacity: 0 }}
            animate={{
              y: 0,
              scale: 1,
              opacity: 1,
              transition: { type: "spring", stiffness: 340, damping: 28 },
            }}
            exit={{
              y: 20,
              scale: 0.97,
              opacity: 0,
              transition: { duration: 0.2, ease: "easeInOut" },
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
              <div className="absolute -bottom-28 right-0 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
            </div>

            <button
              aria-label="Close auth modal"
              className="absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10"
              onClick={close}
              type="button"
            >
              <FiX size={18} />
            </button>

            <div className="relative z-10 px-6 py-7 sm:px-8 sm:py-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1, transition: { duration: 0.22 } }}
                  exit={{ y: -10, opacity: 0, transition: { duration: 0.18 } }}
                >
                  {mode === "login" ? (
                    <LoginForm onSuccess={close} />
                  ) : (
                    <SignupForm onSuccess={close} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

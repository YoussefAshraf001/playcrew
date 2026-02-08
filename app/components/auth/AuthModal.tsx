"use client";

import LoginForm from "@/app/(public)/login/LoginPage";
import SignupForm from "@/app/(public)/signup/SignupPage";
import { useAuthModal } from "@/app/context/AuthModalContext";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthModal() {
  const { mode, close } = useAuthModal();

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="w-full max-w-sm bg-zinc-900 rounded-xl p-6"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {mode === "login" ? (
              <LoginForm onSuccess={close} />
            ) : (
              <SignupForm onSuccess={close} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

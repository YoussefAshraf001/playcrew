"use client";

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/app/lib/firebase";
import { toast } from "react-hot-toast";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useAuthModal } from "@/app/context/AuthModalContext";
import { IoMdMail } from "react-icons/io";

export default function LoginForm({ onSuccess }: { onSuccess?: () => void }) {
  const { open } = useAuthModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      toast.loading("Logging in...");

      await signInWithEmailAndPassword(auth, email, password);

      toast.dismiss();
      toast.success("Welcome back!");
      onSuccess?.();
    } catch {
      toast.dismiss();
      toast.error("Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) return toast.error("Enter your email first");
    await sendPasswordResetEmail(auth, email);
    toast(
      () => (
        <div>
          <p className="text-sm mb-2">
            A password reset email has been sent. Please check your inbox or
            spam folder.
          </p>

          <div className="h-1 w-full bg-zinc-700 rounded overflow-hidden">
            <div
              className="h-full bg-cyan-400 animate-toast-progress"
              style={{ animationDuration: "4000ms" }}
            />
          </div>
        </div>
      ),
      {
        icon: <IoMdMail size={50} />,
        duration: 4000,
      },
    );
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4 h-100">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">
          Welcome Back
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-white">
          Log in to PlayCrew
        </h2>
        <p className="text-sm text-zinc-400">
          Access your dashboard, screenshots, and crew updates.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
            Email
          </span>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/70 focus:bg-white/[0.07]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
            Password
          </span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/70 focus:bg-white/[0.07]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-cyan-300"
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
        </label>
      </div>

      <div className="w-full text-right text-xs">
        <button
          className="font-semibold text-zinc-400 transition hover:text-cyan-300"
          type="button"
          onClick={handleReset}
        >
          Forgot password?
        </button>
      </div>

      <button
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 font-semibold text-black shadow-[0_10px_25px_rgba(34,211,238,0.3)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <span className="loading loading-dots loading-sm" />
        ) : (
          "Log In"
        )}
      </button>

      <p className="text-center text-sm text-zinc-400 mt-5">
        New here?{" "}
        <button
          type="button"
          onClick={() => open("signup")}
          className="font-semibold text-cyan-300 transition hover:text-cyan-200"
        >
          Create an account
        </button>
      </p>
    </form>
  );
}

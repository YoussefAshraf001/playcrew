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
import { IoMdMail, IoMdMailUnread } from "react-icons/io";

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
      (t) => (
        <div>
          <p className="text-sm mb-2">
            A password reset email has been sent. Please check your inbox or
            spam folder.
          </p>

          {/* Progress bar */}
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
    <form onSubmit={handleLogin} className="space-y-4">
      <h2 className="text-2xl font-bold text-center">Log in to continue</h2>

      <input
        type="email"
        placeholder="Email"
        className="w-full p-3 rounded bg-zinc-800"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      {/* Password field */}
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          className="w-full p-3 pr-10 rounded bg-zinc-800"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-cyan-400 transition"
        >
          {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
        </button>
      </div>
      <div className="w-full text-right">
        <button
          className="text-xs text-zinc-400 cursor-pointer"
          type="button"
          onClick={handleReset}
        >
          Forgot password?
        </button>
      </div>

      <button
        disabled={loading}
        className="w-full bg-cyan-500 text-black font-bold py-3 rounded cursor-pointer hover:bg-cyan-400 transition duration-300"
      >
        {loading ? (
          <>
            <span className="loading loading-dots loading-sm" />
          </>
        ) : (
          "Login"
        )}
      </button>

      <div className="flex justify-center text-sm text-zinc-400">
        <p className="text-sm text-center text-zinc-400">
          New here?{" "}
          <button
            type="button"
            onClick={() => open("signup")}
            className="text-cyan-400 cursor-pointer"
          >
            Sign up
          </button>
        </p>
      </div>
    </form>
  );
}

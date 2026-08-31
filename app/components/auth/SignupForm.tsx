"use client";

import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";
import { toast } from "react-hot-toast";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useAuthModal } from "@/app/context/AuthModalContext";

export default function SignupForm({ onSuccess }: { onSuccess?: () => void }) {
  const { open } = useAuthModal();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedUsername = username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "")
      .replace(/_+/g, "_")
      .replace(/^[-_]+|[-_]+$/g, "");

    if (normalizedUsername.length < 3) {
      toast.error("Username must contain at least 3 characters.");
      return;
    }

    try {
      setLoading(true);
      toast.loading("Creating account...");

      const usernameQuery = query(
        collection(db, "users"),
        where("username", "==", normalizedUsername),
        limit(1),
      );
      const existingUsername = await getDocs(usernameQuery);
      if (!existingUsername.empty) {
        toast.dismiss();
        toast.error("That username is identical to another user's username.");
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const cred = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password,
      );

      const user = cred.user;

      try {
        await runTransaction(db, async (transaction) => {
          const usernameRef = doc(db, "usernames", normalizedUsername);
          const usernameSnap = await transaction.get(usernameRef);
          if (
            usernameSnap.exists() &&
            usernameSnap.data().uid !== user.uid
          ) {
            throw new Error("username-already-taken");
          }

          transaction.set(doc(db, "users", user.uid), {
            uid: user.uid,
            username: normalizedUsername,
            email: normalizedEmail,
            createdAt: new Date(),
          });
          transaction.set(usernameRef, {
            uid: user.uid,
            username: normalizedUsername,
          });
        });
      } catch (error) {
        await deleteUser(user).catch(() => undefined);
        throw error;
      }

      await updateProfile(user, { displayName: normalizedUsername });

      toast.dismiss();
      toast.success("Welcome to PlayCrew!", { icon: "👋" });
      onSuccess?.();
    } catch (err: unknown) {
      toast.dismiss();
      const code = (err as { code?: string })?.code;

      if (code === "auth/email-already-in-use") {
        toast.error("That email is already registered. Try logging in instead.");
      } else if ((err as Error)?.message === "username-already-taken") {
        toast.error("That username is identical to another user's username.");
      } else if (code === "auth/invalid-email") {
        toast.error("That email address looks invalid.");
      } else if (code === "auth/weak-password") {
        toast.error("Password is too weak. Use at least 6 characters.");
      } else {
        toast.error("Signup failed. Try again.");
      }

      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignup} className="space-y-5">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">
          Join PlayCrew
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-white">
          Create your account
        </h2>
        <p className="text-sm text-zinc-400">
          Start tracking games, progress, and your screenshot journey.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
            Username
          </span>
          <input
            type="text"
            placeholder="Choose a unique username"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/70 focus:bg-white/[0.07]"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={32}
            autoComplete="username"
            required
          />
        </label>

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
              placeholder="Choose a strong password"
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

      <button
        disabled={loading}
        className="w-full rounded-xl bg-linear-to-r from-cyan-400 to-blue-500 px-4 py-3 font-semibold text-black shadow-[0_10px_25px_rgba(34,211,238,0.3)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <span className="loading loading-dots loading-sm" />
        ) : (
          "Sign Up"
        )}
      </button>

      <p className="text-center text-sm text-zinc-400 mt-5">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => open("login")}
          className="font-semibold text-cyan-300 transition hover:text-cyan-200"
        >
          Log in
        </button>
      </p>
    </form>
  );
}

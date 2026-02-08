"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";
import { toast } from "react-hot-toast";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useAuthModal } from "@/app/context/AuthModalContext";

export default function SignupForm({ onSuccess }: { onSuccess?: () => void }) {
  const { open } = useAuthModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      toast.loading("Creating account...");

      const cred = await createUserWithEmailAndPassword(auth, email, password);

      const user = cred.user;
      const username = email.split("@")[0];

      await setDoc(doc(db, "users", user.uid), {
        username,
        createdAt: new Date(),
      });

      await updateProfile(user, { displayName: username });

      toast.dismiss();
      toast.success("Welcome to PlayCrew!");
      onSuccess?.();
    } catch (err) {
      toast.dismiss();
      toast.error("Signup failed. Try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignup} className="space-y-4">
      <h2 className="text-2xl font-bold text-center">Create your account</h2>

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

      <button
        disabled={loading}
        className="w-full bg-cyan-500 text-black font-bold py-3 rounded cursor-pointer hover:bg-cyan-400 transition duration-300"
      >
        {loading ? (
          <>
            <span className="loading loading-dots loading-xs" />
          </>
        ) : (
          "Sign up"
        )}
      </button>

      <p className="text-sm text-center text-zinc-400">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => open("login")}
          className="text-cyan-400 cursor-pointer"
        >
          Log in
        </button>
      </p>
    </form>
  );
}

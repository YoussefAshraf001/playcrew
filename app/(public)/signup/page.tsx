"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebase";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import LoadingSpinner from "@/app/components/LoadingSpinner";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/dashboard");
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);
      toast.loading("Creating your account...");

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      const username = email.split("@")[0];

      await setDoc(doc(db, "users", user.uid), {
        username,
        email,
        createdAt: new Date(),
        defaultAvatar: `https://api.dicebear.com/8.x/bottts/svg?seed=${username}`,
        xp: 0,
        level: 1,
        stats: {
          gamesTracked: 0,
          friends: 0,
        },
      });

      toast.dismiss();
      toast.success("Welcome to PlayCrew!");
      router.push("/dashboard");
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return <LoadingSpinner />;
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-black text-white">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-sm p-7 rounded-xl bg-zinc-900 space-y-5"
      >
        <h1 className="text-3xl font-bold text-center">Create Account</h1>

        <motion.input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          whileFocus={{ scale: 1.02 }}
          className="w-[98%] p-3 rounded-md bg-zinc-800 focus:ring-1 focus:ring-cyan-500 focus:outline-none duration-300"
          required
        />

        <motion.input
          type="password"
          placeholder="Password"
          autoComplete="Password"
          value={email}
          onChange={(e) => setPassword(e.target.value)}
          whileFocus={{ scale: 1.02 }}
          className="w-[98%] p-3 rounded-md bg-zinc-800 focus:ring-1 focus:ring-cyan-500 focus:outline-none duration-300"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-[98%] p-3 rounded-md bg-cyan-300 text-black font-bold hover:scale-105 ease-in-out transition-all duration-300 cursor-pointer"
        >
          {loading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <>{loading ? "Signing up" : "Join PlayCrew"}</>
          )}
        </button>
        <p className="text-center text-sm">
          Already have an account?{" "}
          <Link className="text-cyan-500" href="/login">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}

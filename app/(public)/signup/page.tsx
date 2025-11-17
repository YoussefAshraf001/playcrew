"use client";

import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <main className="flex items-center justify-center min-h-screen bg-black text-white">
      <form
        onSubmit={handleSignup}
        className="w-full max-w-sm p-8 rounded-xl bg-zinc-900 space-y-5"
      >
        <h1 className="text-3xl font-bold text-center">Create Account</h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-3 rounded-md bg-zinc-800"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-3 rounded-md bg-zinc-800"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full p-3 rounded-md bg-cyan-300 text-black font-bold"
        >
          {loading ? "Signing up..." : "Join PlayCrew"}
        </button>

        <p className="text-center text-sm">
          Already have an account?{" "}
          <a href="/login" className="text-cyan-400">
            Log in
          </a>
        </p>
      </form>
    </main>
  );
}

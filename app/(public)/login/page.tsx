"use client";

import { useState, useEffect } from "react";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LoadingSpinner from "@/app/components/LoadingSpinner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Redirect if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/dashboard");
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error("Email and password required.");
      return;
    }

    try {
      setLoading(true);
      toast.loading("Logging in...");

      await signInWithEmailAndPassword(auth, email, password);

      toast.dismiss();
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (error: any) {
      toast.dismiss();
      console.error("Login error:", error.code);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/invalid-email" ||
        error.code === "auth/missing-password"
      ) {
        toast.error("Incorrect email or password.");
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many attempts. Try again later.");
      } else {
        toast.error("Login failed. Please try again.");
      }
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
        onSubmit={handleLogin}
        className="w-full max-w-sm p-8 rounded-xl bg-zinc-900 space-y-5"
      >
        <h1 className="text-3xl font-bold text-center">Welcome Back</h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-3 rounded-md bg-zinc-800"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-3 rounded-md bg-zinc-800"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full p-3 rounded-md bg-cyan-300 text-black font-bold hover:scale-105 ease-in-out transition-all duration-300 cursor-pointer"
        >
          {loading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <>{loading ? "Logging in" : "Login"}</>
          )}
        </button>
        <p className="text-center text-sm">
          New Here?{" "}
          <Link className="text-cyan-500" href="/signup">
            Sign Up
          </Link>
        </p>
      </form>
    </main>
  );
}

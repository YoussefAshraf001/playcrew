"use client";

import { useState, useEffect } from "react";
import { auth } from "../../lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiEye, FiEyeOff } from "react-icons/fi";

import LoadingSpinner from "@/app/components/LoadingSpinner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

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

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email first");
      return;
    }

    try {
      toast.loading("Sending reset email...");
      await sendPasswordResetEmail(auth, email.trim());
      toast.dismiss();
      toast.success(
        "If an account exists for this email, a reset link will be sent now.",
      );
    } catch (error: any) {
      toast.dismiss();

      if (error.code === "auth/user-not-found") {
        toast.error("No account found with this email.");
      } else if (error.code === "auth/invalid-email") {
        toast.error("Invalid email address.");
      } else {
        toast.error("Failed to send reset email.");
      }
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

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            className="w-full p-3 pr-10 rounded-md bg-zinc-800"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition cursor-pointer duration-300"
          >
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        </div>

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
        <div className="text-right text-xs">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-cyan-700 hover:text-cyan-400 underline underline-offset-2 transition cursor-pointer"
          >
            Forgot your password?
          </button>
        </div>
      </form>
    </main>
  );
}

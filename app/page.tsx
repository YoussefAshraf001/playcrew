"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/dashboard");
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (checkingAuth) {
    return (
      <main className="w-full h-screen flex items-center justify-center bg-black text-white">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="w-full h-screen flex items-center justify-center bg-black text-white px-6">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <h1 className="text-4xl font-bold tracking-tight">PlayCrew</h1>
        <p className="text-zinc-400 text-lg">
          Track your games. Add your crew. Compete and level up together.
        </p>

        <div className="flex flex-col gap-3 w-full">
          <Link
            href="/signup"
            className="w-full rounded-full bg-cyan-500 text-black py-3 font-semibold hover:bg-cyan-400 transition"
          >
            Get Started
          </Link>

          <Link
            href="/login"
            className="w-full rounded-full border border-cyan-500 py-3 font-semibold text-cyan-500 hover:bg-cyan-500 hover:text-black transition"
          >
            Log In
          </Link>
        </div>
      </div>
    </main>
  );
}

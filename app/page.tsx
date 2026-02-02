"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import LoadingSpinner from "./components/LoadingSpinner";
import { Helmet } from "react-helmet-async";

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
    return <LoadingSpinner />;
  }

  return (
    <>
      <Helmet>
        <title>PlayCrew</title>
      </Helmet>
      <main className="relative w-full h-screen flex items-center justify-center bg-black text-white px-6 overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-cyan-500/20 blur-3xl rounded-full" />
          <div className="absolute bottom-[-120px] right-1/4 w-[360px] h-[360px] bg-blue-500/20 blur-3xl rounded-full" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-7 max-w-md text-center">
          {/* Badge */}
          <span className="text-xs uppercase tracking-widest text-cyan-400 border border-cyan-400/30 px-4 py-1 rounded-full">
            Catch Up
          </span>

          {/* Logo / Title */}
          <h1 className="text-5xl font-extrabold tracking-tight bg-linear-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            PlayCrew
          </h1>

          {/* Tagline */}
          <p className="text-zinc-400 text-lg leading-relaxed">
            Track your games. Build your crew.
            <br />
            Sweat, level up, and win.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col gap-3 w-full mt-2">
            <Link
              href="/signup"
              className="w-full rounded-full bg-cyan-500 text-black py-3 font-semibold transition transform hover:-translate-y-0.5 hover:bg-cyan-400 hover:shadow-lg hover:shadow-cyan-500/30"
            >
              Start Your Journey Now
            </Link>

            <Link
              href="/login"
              className="w-full rounded-full border border-cyan-500 py-3 font-semibold text-cyan-500 transition transform hover:-translate-y-0.5 hover:bg-cyan-500 hover:text-black hover:shadow-lg hover:shadow-cyan-500/20"
            >
              Log In
            </Link>
          </div>

          {/* Subtle footer text */}
          <p className="text-xs text-zinc-500 mt-6">Built for gamers</p>
        </div>
      </main>
    </>
  );
}

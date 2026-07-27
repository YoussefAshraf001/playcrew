"use client";

import { FormEvent, useState } from "react";
import { searchUsersByUsername } from "@/app/lib/social";
import Link from "next/link";
import { useUser } from "@/app/context/UserContext";
import { FiSearch } from "react-icons/fi";

type SearchUser = {
  id: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatar?: {
    data?: string;
  } | null;
};

export default function UserSearchPage() {
  const { profile } = useUser();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = (await searchUsersByUsername(
        q || "",
        20,
        profile?.username,
      )) as SearchUser[];
      setResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden theme-bg px-4 py-6 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--theme-accent-rgb),0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.12),transparent_28%)]" />
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="theme-panel rounded-[32px] border border-[var(--theme-border)] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="theme-accent-soft-text text-[11px] font-semibold uppercase tracking-[0.28em]">
                Discover People
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                Search Users
              </h1>
              <p className="theme-text-muted mt-3 text-sm leading-relaxed sm:text-base">
                Find players by username, jump into their profile, and browse
                their library or reviews.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm theme-text-muted">
              Signed in as{" "}
              <span className="font-semibold theme-text">
                {profile?.username || "guest"}
              </span>
            </div>
          </div>

          <form onSubmit={handleSearch} className="mt-5">
            <div className="theme-surface-alt flex items-center gap-3 rounded-[24px] border border-white/10 px-4 py-3">
              <FiSearch className="theme-text-muted shrink-0" size={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by username"
                className="h-10 w-full bg-transparent text-base outline-none placeholder:text-zinc-500"
              />
              <button
                type="submit"
                className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-5 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/18"
              >
                Search
              </button>
            </div>
          </form>
        </section>

        {loading ? (
          <div className="theme-panel flex min-h-[40vh] items-center justify-center rounded-[28px] border border-[var(--theme-border)]">
            <span className="loading loading-dots loading-lg text-cyan-300" />
          </div>
        ) : (
          <section className="theme-panel rounded-[28px] border border-[var(--theme-border)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Results</h2>
              <span className="theme-text-muted text-sm">
                {results.length} found
              </span>
            </div>

            {results.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {results.map((u) => (
                  <Link
                    key={u.id}
                    href={`/users/${u.username}`}
                    className="group rounded-[24px] border border-white/8 bg-white/[0.03] p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-zinc-800">
                        {u.avatar?.data ? (
                          <img
                            src={u.avatar.data}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-semibold">
                            {u.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-base font-bold">
                            {u.displayName || u.username}
                          </div>
                          <span className="rounded-full border border-rose-300/20 bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-200">
                            User
                          </span>
                        </div>
                        <p className="theme-text-muted mt-2 line-clamp-2 text-sm">
                          {u.bio}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--theme-border)] p-10 text-center theme-text-muted">
                Search for someone to view their profile
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

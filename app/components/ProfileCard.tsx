"use client";

import FriendButton from "./social/FriendButton";

type ProfileCardProps = {
  profile: {
    uid?: string;
    username?: string;
    displayName?: string;
    bio?: string;
    avatar?: { data?: string } | null;
    createdAt?:
      | {
          toDate?: () => Date;
        }
      | string
      | Date
      | null;
  };
};

const hasToDate = (
  value: unknown,
): value is { toDate: () => Date } => {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  );
};

export default function ProfileCard({ profile }: ProfileCardProps) {
  const joinedDate = hasToDate(profile?.createdAt)
    ? profile.createdAt.toDate()
    : typeof profile?.createdAt === "string"
      ? new Date(profile.createdAt)
      : profile?.createdAt instanceof Date
        ? profile.createdAt
        : null;

  return (
    <div className="theme-panel rounded-[28px] border border-[var(--theme-border)] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.25)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="relative mx-auto lg:mx-0">
          <div className="absolute inset-0 rounded-full bg-cyan-400/15 blur-2xl" />
          {profile?.avatar?.data ? (
            <img
              src={profile.avatar.data}
              alt=""
              aria-hidden="true"
              className="relative h-28 w-28 rounded-full object-cover ring-2 ring-cyan-300/20 sm:h-32 sm:w-32"
            />
          ) : (
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-zinc-800 text-2xl ring-2 ring-cyan-300/20 sm:h-32 sm:w-32">
              {profile?.username?.[0]?.toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 text-center lg:text-left">
          <div className="flex flex-col gap-1.5">
            <p className="theme-accent-soft-text text-[11px] font-semibold uppercase tracking-[0.28em]">
              Member profile
            </p>
            <h2 className="text-3xl font-black tracking-tight">
              {profile?.displayName || profile?.username ? `@${profile.displayName || profile.username}` : "@"}
            </h2>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
              Joined: {joinedDate ? joinedDate.toLocaleDateString() : "Unknown"}
            </span>
          </div>

          <p className="theme-text-muted mt-4 max-w-2xl text-sm leading-relaxed sm:text-[15px]">
            {profile?.bio || "No bio yet."}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <FriendButton
              targetUid={profile?.uid}
              targetUsername={profile?.username}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

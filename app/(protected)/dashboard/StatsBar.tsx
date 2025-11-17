"use client";

export default function StatsBar({ profile }: { profile: any }) {
  const games = profile.trackedGames ? Object.values(profile.trackedGames) : [];

  const total = games.length;
  const completed = games.filter((g: any) => g.status === "Completed").length;
  const onHold = games.filter((g: any) => g.status === "On Hold").length;
  const dropped = games.filter((g: any) => g.status === "Dropped").length;
  const notSet = games.filter((g: any) => !g.status).length;

  return (
    <div className="flex flex-wrap justify-center sm:justify-between items-center gap-6 text-center bg-zinc-900/60 p-6 rounded-2xl shadow-lg">
      <Stat label="All" value={total} color="text-cyan-400" />
      <Stat label="Completed" value={completed} color="text-green-400" />
      <Stat label="On Hold" value={onHold} color="text-yellow-400" />
      <Stat label="Dropped" value={dropped} color="text-red-400" />
      <Stat label="Not Set Yet" value={notSet} color="text-zinc-400" />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
      <p className="text-sm text-zinc-400">{label}</p>
    </div>
  );
}

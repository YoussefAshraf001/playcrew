"use client";

export default function StatusTabs({
  statuses,
  selected,
  onSelect,
  counts,
}: {
  statuses: string[];
  selected: string;
  onSelect: (status: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {statuses.map((status) => (
        <button
          key={status}
          onClick={() => onSelect(status)}
          className={`px-4 py-2 rounded-full font-semibold transition ${
            selected === status
              ? "bg-cyan-500 text-black"
              : "bg-zinc-800 text-white hover:bg-zinc-700"
          }`}
        >
          {status}{" "}
          <span className="text-cyan-400 ml-1">({counts[status] || 0})</span>
        </button>
      ))}
    </div>
  );
}

export default function RatingsBreakdown({ ratings }: { ratings: any[] }) {
  return (
    <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
      <h4 className="text-cyan-300 font-semibold mb-3">Ratings Breakdown</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ratings.map((r) => (
          <div key={r.id} className="p-3 bg-zinc-900/40 rounded-lg text-center">
            <div className="text-sm text-cyan-300 capitalize">{r.title}</div>
            <div className="text-yellow-400 font-bold text-lg">{r.count}</div>
            <div className="text-xs text-gray-300">
              {r.percent?.toFixed?.(1) ?? 0}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

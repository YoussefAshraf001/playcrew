export default function PlayerStatus({
  data,
}: {
  data: Record<string, number>;
}) {
  return (
    <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
      <h4 className="text-cyan-300 font-semibold mb-2">Players Status</h4>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="p-2 bg-zinc-900/40 rounded">
            <p className="text-sm text-gray-300 capitalize">{k}</p>
            <p className="text-yellow-400 font-bold">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

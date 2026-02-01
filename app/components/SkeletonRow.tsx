export default function SkeletonRow() {
  return (
    <div>
      <div className="h-6 w-48 bg-zinc-800 rounded mb-4" />
      <div className="flex gap-6 justify-center">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="w-[200px] h-[280px] bg-zinc-800 rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

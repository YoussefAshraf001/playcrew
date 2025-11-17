export default function XPBadge({
  hltbData,
}: {
  hltbData: { mainStory: number };
}) {
  const xp = hltbData.mainStory > 0 ? Math.floor(hltbData.mainStory * 10) : 25;

  return (
    <div className="w-full flex justify-center items-center rounded-lg text-white">
      <div className="w-1/2 bg-zinc-800/50 p-4 rounded-lg text-white border border-zinc-700">
        <p className="text-green-400 font-bold text-center">XP: {xp}</p>
      </div>
    </div>
  );
}

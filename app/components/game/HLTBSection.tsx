export default function HLTBSection({
  hltbData,
}: {
  hltbData: { mainStory: number; completionist: number };
}) {
  return (
    <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 text-white">
      <h4 className="text-cyan-300 font-semibold mb-2">HowLongToBeat</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-sm text-gray-300">Main Story</p>
          <p className="text-yellow-400 font-bold">
            {hltbData.mainStory || "N/A"} hrs
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-300">Completionist</p>
          <p className="text-yellow-400 font-bold">
            {hltbData.completionist || "N/A"} hrs
          </p>
        </div>
      </div>
    </div>
  );
}

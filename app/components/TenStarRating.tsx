import { FaStar, FaStarHalfAlt, FaRegStar } from "react-icons/fa";

export default function FiveStarRating({ rating }: { rating?: number }) {
  const safe = Math.max(0, Math.min(10, rating ?? 0)); // 0-10

  return (
    <div
      className="flex items-center gap-1 text-yellow-400"
      title={`Rating: ${safe} / 10`}
    >
      <span className="text-sm text-zinc-300">Rating:</span>

      {Array.from({ length: 5 }, (_, i) => {
        const starValue = (i + 1) * 2; // 2, 4, 6, 8, 10
        let starIcon;

        if (safe >= starValue) {
          starIcon = <FaStar key={i} />;
        } else if (safe >= starValue - 1) {
          starIcon = <FaStarHalfAlt key={i} />;
        } else {
          starIcon = <FaRegStar key={i} className="text-yellow-400/30" />;
        }

        return starIcon;
      })}

      <span className="ml-2 text-xs text-zinc-400 font-medium">
        {safe} / 10
      </span>
    </div>
  );
}

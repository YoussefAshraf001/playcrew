import Image from "next/image";
import { GAME_STICKERS } from "../lib/gameStickers";

export default function GameSticker({
  stickerId,
}: {
  stickerId?: string | null;
}) {
  const sticker = GAME_STICKERS.find((s) => s.id === stickerId);

  if (!sticker) return null;

  const isAnimatedFormat = /\.(gif|webp)(?:$|[?#])/i.test(sticker.image);

  return (
    <Image
      src={sticker.image}
      alt={sticker.label}
      width={120}
      height={120}
      unoptimized={isAnimatedFormat}
      className="object-contain rounded-md"
    />
  );
}

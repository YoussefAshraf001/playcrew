import Image from "next/image";
import { GAME_STICKERS } from "../lib/gameStickers";

export default function GameSticker({
  stickerId,
  size = 120,
}: {
  stickerId?: string | null;
  size?: number;
}) {
  const sticker = GAME_STICKERS.find((s) => s.id === stickerId);

  if (!sticker) return null;

  const isAnimatedFormat = /\.(gif|webp)(?:$|[?#])/i.test(sticker.image);

  return (
    <Image
      src={sticker.image}
      alt={sticker.label}
      width={size}
      height={size}
      unoptimized={isAnimatedFormat}
      className="object-contain rounded-md"
    />
  );
}

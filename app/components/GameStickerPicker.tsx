"use client";

import Image from "next/image";
import { GAME_STICKERS } from "../lib/gameStickers";

export type GameSticker = {
  id: string;
  label: string;
  image: string;
};

interface Props {
  value?: string | null;
  onChange: (stickerId: string | null) => void;
}

export default function GameStickerPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Verdict Sticker</h3>

        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-zinc-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {GAME_STICKERS.map((sticker) => {
          const active = value === sticker.id;

          return (
            <button
              key={sticker.id}
              type="button"
              onClick={() => onChange(sticker.id)}
              className={`
                rounded-2xl border p-3 transition
                active
                  ? "border-amber-300 bg-amber-300/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              `}
            >
              <div className="relative mx-auto h-24 w-24">
                <Image
                  src={sticker.image}
                  alt={sticker.label}
                  fill
                  className="object-contain"
                />
              </div>

              <p className="mt-2 text-xs text-white">{sticker.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

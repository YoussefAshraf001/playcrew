"use client";

import {
  FaSteam,
  FaPlaystation,
  FaXbox,
  FaApple,
  FaAndroid,
  FaPlus,
} from "react-icons/fa";
import { SiEpicgames, SiGogdotcom } from "react-icons/si";
import { BsNintendoSwitch } from "react-icons/bs";
import { Game } from "../../types/game";

interface StoresListProps {
  game: Game;
}

export default function StoresList({ game }: StoresListProps) {
  if (!game?.stores || game.stores.length === 0) return null;

  const getStoreUrlFor = (s: any) => {
    const apiUrl = s.url_en || s.url;
    const slug = s.store?.slug?.toLowerCase?.() || "";
    const q = encodeURIComponent(game.name);

    const fallbackBySlug: Record<string, string> = {
      steam: `https://store.steampowered.com/search/?term=${q}`,
      epic: `https://store.epicgames.com/en-US/browse?q=${q}`,
      playstation: `https://store.playstation.com/en-us/search/${q}`,
      xbox: `https://www.xbox.com/en-US/search?q=${q}`,
      nintendo: `https://www.nintendo.com/search/#q=${q}`,
      gog: `https://www.gog.com/games?search=${q}`,
      apple: `https://apps.apple.com/search?term=${q}`,
      ios: `https://apps.apple.com/search?term=${q}`,
      android: `https://play.google.com/store/search?q=${q}`,
    };

    return apiUrl || fallbackBySlug[slug] || `https://${slug}.com`;
  };

  const getStoreIcon = (name: string) => {
    if (/steam/i.test(name)) return <FaSteam className="text-white" />;
    if (/playstation/i.test(name))
      return <FaPlaystation className="text-blue-500" />;
    if (/xbox/i.test(name)) return <FaXbox className="text-green-500" />;
    if (/nintendo/i.test(name))
      return <BsNintendoSwitch className="text-red-500" />;
    if (/epic/i.test(name)) return <SiEpicgames className="text-white" />;
    if (/android/i.test(name)) return <FaAndroid className="text-green-600" />;
    if (/ios|apple/i.test(name)) return <FaApple className="text-gray-400" />;
    if (/gog/i.test(name)) return <SiGogdotcom className="text-gray-400" />;
    return <FaPlus />;
  };

  return (
    <div className="flex flex-wrap gap-2">
      {game.stores.map((s, idx) => (
        <a
          key={idx}
          href={getStoreUrlFor(s)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/6 text-white hover:bg-cyan-500 hover:text-black transition"
        >
          {getStoreIcon(s.store?.name ?? s.store?.slug)}
          <span className="text-sm font-medium">
            {s.store?.name ?? s.store?.slug}
          </span>
        </a>
      ))}

      {/* Fitgirl */}
      <button
        onClick={() =>
          window.open(
            `https://fitgirl-repacks.site/?s=${encodeURIComponent(game.name)}`,
            "_blank"
          )
        }
        className="cursor-pointer px-3 py-1 rounded-lg bg-white/6 text-white hover:bg-cyan-500 hover:text-black transition"
      >
        <img
          src="/logos/Fitgirl.jpg"
          alt="Fitgirl"
          className="w-5 h-5 inline-block mr-2 rounded"
        />
        Fitgirl
      </button>

      {/* DODI */}
      <button
        onClick={() =>
          window.open(
            `https://dodi-repacks.site/?s=${encodeURIComponent(game.name)}`,
            "_blank"
          )
        }
        className="cursor-pointer px-3 py-1 rounded-lg bg-white/6 text-white hover:bg-cyan-500 hover:text-black transition"
      >
        <img
          src="/logos/DODI.jpg"
          alt="DODI"
          className="w-5 h-5 inline-block mr-2 rounded-full"
        />
        DODI
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_KEY = process.env.NEXT_PUBLIC_RAWG_API_KEY;

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      const res = await fetch(
        `https://api.rawg.io/api/games?key=${API_KEY}&search=${query}&page_size=6`
      );
      const data = await res.json();
      setResults(data.results || []);
    };

    const timeout = setTimeout(fetchResults, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="relative w-1/3">
      <input
        type="text"
        value={query}
        placeholder="Search games..."
        onChange={(e) => {
          setQuery(e.target.value);
          setShowDropdown(true);
        }}
        className="bg-[#2a2a2a] text-white rounded-lg px-4 py-2 w-full outline-none"
      />

      {/* Dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute left-0 top-12 w-full bg-[#1e1e1e] border border-white/10 rounded-lg shadow-lg z-50">
          {results.map((game) => (
            <Link
              key={game.id}
              href={`/game/${game.id}`}
              onClick={() => setShowDropdown(false)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 transition"
            >
              <img
                src={game.background_image}
                className="w-10 h-14 object-cover rounded-md"
                alt=""
              />
              <span className="text-white text-sm">{game.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

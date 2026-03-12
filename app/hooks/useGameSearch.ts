"use client";

import { useEffect, useRef, useState } from "react";

export type SearchGame = {
  id: number;
  name: string;
  cover?: { url: string };
  first_release_date?: number;
};

export function useGameSearch(query: string) {
  const [results, setResults] = useState<SearchGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/igdb/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim() }),
        });

        if (!res.ok) throw new Error("Search failed");

        const data = await res.json();

        const withCovers = (data as SearchGame[]).filter((g) => g.cover?.url);

        setResults(withCovers);
      } catch (err) {
        console.error(err);
        setError("Search failed.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { results, loading, error };
}

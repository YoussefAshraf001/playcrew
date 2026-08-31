import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Discovery Deck",
  description: "Discover new games, browse recommendations, and explore what to play next.",
};

export default function ExploreLayout({ children }: { children: ReactNode }) {
  return children;
}

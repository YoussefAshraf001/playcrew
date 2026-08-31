import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Game Details",
  description: "View game details, ratings, and tracking progress on PlayCrew.",
};

export default function GameLayout({ children }: { children: ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Picked For You",
  description: "Genre-based recommendations personalized from your library.",
};

export default function ForYouLayout({ children }: { children: ReactNode }) {
  return children;
}

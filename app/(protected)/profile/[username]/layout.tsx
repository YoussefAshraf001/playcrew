import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Player Profile",
  description: "Explore a PlayCrew player's collection, activity, and highlights.",
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}

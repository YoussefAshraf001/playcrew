import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Awards Shelf",
  description: "Build and manage your yearly PlayCrew game awards.",
};

export default function AwardsLayout({ children }: { children: ReactNode }) {
  return children;
}

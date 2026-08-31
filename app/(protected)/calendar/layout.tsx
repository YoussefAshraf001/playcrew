import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Release Radar",
  description: "Track upcoming and recent game releases in your PlayCrew release calendar.",
};

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return children;
}

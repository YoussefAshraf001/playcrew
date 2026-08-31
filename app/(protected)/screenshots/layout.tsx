import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Shots Gallery",
  description: "Curate your game screenshots in an art-gallery style workspace.",
};

export default function ScreenshotsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}

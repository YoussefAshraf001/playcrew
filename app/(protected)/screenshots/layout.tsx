import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "PlayCrew - Screenshots Gallery",
};

export default function ScreenshotsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}

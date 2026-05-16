import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Shots Gallery • PlayCrew",
};

export default function ScreenshotsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}

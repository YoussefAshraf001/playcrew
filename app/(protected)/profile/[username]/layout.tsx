import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Identity Hub",
  description: "Manage your PlayCrew profile, preferences, and account settings.",
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Main Menu",
  description: "Your PlayCrew dashboard for tracking progress, activity, and updates.",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}

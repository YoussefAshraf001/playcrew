import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Find Players" };

export default function UserSearchLayout({ children }: { children: ReactNode }) {
  return children;
}

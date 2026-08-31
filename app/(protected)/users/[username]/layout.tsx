import type { Metadata } from "next";
import type { ReactNode } from "react";

type UserLayoutProps = {
  children: ReactNode;
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: UserLayoutProps): Promise<Metadata> {
  const { username } = await params;
  return { title: `${decodeURIComponent(username)}'s Profile` };
}

export default function UserLayout({ children }: UserLayoutProps) {
  return children;
}

"use client";

import { ReactNode } from "react";

import "./globals.css";

import GlobalToaster from "./components/GlobalToaster";
import MusicPlayer from "./components/MusicPlayer";
import AuthModal from "./components/auth/AuthModal";

import Providers from "./components/Providers";
import AppShell from "./components/AppShell";
import AppServices from "./components/AppServices";

import { uiBootstrapScript } from "./lib/uiBootstrapScript";
import { usePersistLastPage } from "./hooks/usePersistLastPage";

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  usePersistLastPage();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: uiBootstrapScript,
          }}
        />
      </head>

      <body className="app-body antialiased">
        <GlobalToaster />

        <Providers>
          <AppServices />

          <AppShell>{children}</AppShell>

          <AuthModal />
          <MusicPlayer />
        </Providers>
      </body>
    </html>
  );
}

"use client";

import { ReactNode, useRef } from "react";
import { motion, Variants } from "framer-motion";
import Navbar from "./components/Navbar";
import ThemeSync from "./components/ThemeSync";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import { MusicProvider } from "./context/MusicContext";
import MusicPlayer from "./components/MusicPlayer";
import { HelmetProvider } from "react-helmet-async";
import GlobalToaster from "./components/GlobalToaster";
import { AuthModalProvider } from "./context/AuthModalContext";
import AuthModal from "./components/auth/AuthModal";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { UIProvider } from "./context/UIContext";
import RouteTransitionLoader from "./components/RouteTransitionLoader";
import { GameProvider } from "./context/GameContext";
import ReleaseDateAutoSync from "./components/ReleaseDateAutoSync";
import ReleaseNotificationSync from "./components/ReleaseNotificationSync";

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const contentVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.8, ease: [0.42, 0, 0.58, 1], delay: 0.8 },
    },
  };

  const pathname = usePathname();
  const hasHydrated = useRef(false);

  useEffect(() => {
    // skip first load
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }

    const blockedRoutes = [
      "/",
      "/menu",
      "/auth",
      "/dashboard",
    ];

    if (!blockedRoutes.includes(pathname)) {
      localStorage.setItem("lastPage", pathname);
    }
  }, [pathname]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="app-body antialiased">
        <GlobalToaster />

        <HelmetProvider>
          <AuthModalProvider>
            <UserProvider>
              <ThemeSync />
              <GameProvider>
                <ReleaseDateAutoSync />
                <ReleaseNotificationSync />
                <MusicProvider>
                  <UIProvider>
                    <RouteTransitionLoader />
                    <div className="app-shell flex min-h-screen overflow-hidden">
                      <Navbar />

                      <motion.main
                        className="flex-1 overflow-y-auto max-w-full"
                        variants={contentVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {children}
                      </motion.main>
                    </div>
                    <AuthModal />
                    <MusicPlayer />
                  </UIProvider>
                </MusicProvider>
              </GameProvider>
            </UserProvider>
          </AuthModalProvider>
        </HelmetProvider>
      </body>
    </html>
  );
}






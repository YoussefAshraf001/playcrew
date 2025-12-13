"use client";

import { ReactNode } from "react";
import { motion, Variants } from "framer-motion";
import Navbar from "./components/Navbar";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import { MusicProvider } from "./context/MusicContext";
import { Toaster } from "react-hot-toast";
import MusicPlayer from "./components/MusicPlayer";
import { HelmetProvider } from "react-helmet-async";

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

  return (
    <html lang="en">
      <body className="antialiased bg-black">
        <Toaster position="top-center" reverseOrder={false} />

        <HelmetProvider>
          <UserProvider>
            <MusicProvider>
              <div className="flex min-h-screen w-screen overflow-hidden">
                {/* Navbar */}
                <Navbar />

                {/* Main content */}
                <motion.main
                  className="flex-1 overflow-y-auto max-w-full"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {children}
                </motion.main>
              </div>

              <MusicPlayer />
            </MusicProvider>
          </UserProvider>
        </HelmetProvider>
      </body>
    </html>
  );
}

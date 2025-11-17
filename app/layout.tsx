"use client";

import { ReactNode, useState } from "react";
import { motion, Variants } from "framer-motion";
import Sidebar from "./components/Sidebar";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import { MusicProvider } from "./context/MusicContext";
import { Toaster } from "react-hot-toast";
import MusicPlayer from "./components/MusicPlayer";

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const [collapsed, setCollapsed] = useState(true);

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

        <UserProvider>
          <MusicProvider>
            <div className="flex min-h-screen w-screen overflow-hidden">
              {/* Sidebar */}
              <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

              {/* Main content */}
              <motion.main
                className="flex-1 overflow-y-auto max-w-full"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                style={{
                  marginLeft: collapsed ? 80 : 256, // match w-20 / w-64 in px
                  transition: "margin-left 0.5s cubic-bezier(0.42,0,0.58,1)",
                }}
              >
                {children}
              </motion.main>
            </div>

            <MusicPlayer />
          </MusicProvider>
        </UserProvider>
      </body>
    </html>
  );
}

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
import {
  DEFAULT_FONT_PRESET,
  DEFAULT_THEME_PRESET,
  FONT_PRESETS,
  THEME_PRESETS,
} from "./lib/themes";
import {
  DEFAULT_NAVBAR_LAYOUT,
  NAVBAR_LAYOUT_STORAGE_KEY,
} from "./lib/uiPreferences";

const THEME_STORAGE_KEY = "playcrew-theme-preset";
const FONT_STORAGE_KEY = "playcrew-font-preset";

const initialUiBootstrapScript = `
(() => {
  try {
    const themeKey = ${JSON.stringify(THEME_STORAGE_KEY)};
    const fontKey = ${JSON.stringify(FONT_STORAGE_KEY)};
    const navbarKey = ${JSON.stringify(NAVBAR_LAYOUT_STORAGE_KEY)};
    const defaultTheme = ${JSON.stringify(DEFAULT_THEME_PRESET)};
    const defaultFont = ${JSON.stringify(DEFAULT_FONT_PRESET)};
    const defaultNavbarLayout = ${JSON.stringify(DEFAULT_NAVBAR_LAYOUT)};
    const themePresets = ${JSON.stringify(THEME_PRESETS.map(({ id }) => id))};
    const fontPresets = ${JSON.stringify(
      FONT_PRESETS.map(
        ({
          id,
          fontFamily,
          buttonScale,
          buttonLetterSpacing,
          buttonLineHeight,
        }) => ({
          id,
          fontFamily,
          buttonScale,
          buttonLetterSpacing,
          buttonLineHeight,
        }),
      ),
    )};

    const storedTheme = window.localStorage.getItem(themeKey);
    const storedFont = window.localStorage.getItem(fontKey);
    const storedNavbarLayout = window.localStorage.getItem(navbarKey);

    const nextTheme = themePresets.includes(storedTheme ?? "")
      ? storedTheme
      : defaultTheme;
    const nextFont = fontPresets.some((preset) => preset.id === storedFont)
      ? storedFont
      : defaultFont;
    const nextNavbarLayout =
      storedNavbarLayout === "top" || storedNavbarLayout === "sidebar"
        ? storedNavbarLayout
        : defaultNavbarLayout;
    const selectedFont =
      fontPresets.find((preset) => preset.id === nextFont) ?? fontPresets[0];

    document.documentElement.dataset.appTheme = nextTheme;
    document.documentElement.dataset.appFont = nextFont;
    document.documentElement.dataset.navbarLayout = nextNavbarLayout;
    document.documentElement.style.setProperty(
      "--app-font",
      selectedFont.fontFamily,
    );
    document.documentElement.style.setProperty(
      "--app-button-font-scale",
      selectedFont.buttonScale,
    );
    document.documentElement.style.setProperty(
      "--app-button-letter-spacing",
      selectedFont.buttonLetterSpacing,
    );
    document.documentElement.style.setProperty(
      "--app-button-line-height",
      selectedFont.buttonLineHeight,
    );
  } catch {
    // If storage is unavailable, the CSS defaults still render the app safely.
  }
})();
`;

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

    const blockedRoutes = ["/", "/menu", "/auth", "/dashboard"];

    if (!blockedRoutes.includes(pathname)) {
      localStorage.setItem("lastPage", pathname);
    }
  }, [pathname]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: initialUiBootstrapScript }}
        />
      </head>
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

// "use client";

// import { ReactNode } from "react";

// import "./globals.css";

// import GlobalToaster from "./components/GlobalToaster";
// import MusicPlayer from "./components/MusicPlayer";
// import AuthModal from "./components/auth/AuthModal";

// import Providers from "./components/Providers";
// import AppShell from "./components/AppShell";
// import AppServices from "./components/AppServices";

// import { uiBootstrapScript } from "./lib/uiBootstrapScript";
// import { usePersistLastPage } from "./hooks/usePersistLastPage";

// interface RootLayoutProps {
//   children: ReactNode;
// }

// export default function RootLayout({ children }: RootLayoutProps) {
//   usePersistLastPage();

//   return (
//     <html lang="en" suppressHydrationWarning>
//       <head>
//         <script
//           dangerouslySetInnerHTML={{
//             __html: uiBootstrapScript,
//           }}
//         />
//       </head>

//       <body className="app-body antialiased">
//         <GlobalToaster />

//         <Providers>
//           <AppServices />

//           <AppShell>{children}</AppShell>

//           <AuthModal />
//           <MusicPlayer />
//         </Providers>
//       </body>
//     </html>
//   );
// }

// "use client";

// import { ReactNode, useRef } from "react";
// import { motion, Variants } from "framer-motion";
// import Navbar from "./components/Navbar";
// import ThemeSync from "./components/ThemeSync";
// import "./globals.css";
// import { UserProvider } from "./context/UserContext";
// import { MusicProvider } from "./context/MusicContext";
// import MusicPlayer from "./components/MusicPlayer";
// import { HelmetProvider } from "react-helmet-async";
// import GlobalToaster from "./components/GlobalToaster";
// import { AuthModalProvider } from "./context/AuthModalContext";
// import AuthModal from "./components/auth/AuthModal";
// import { usePathname } from "next/navigation";
// import { useEffect } from "react";
// import { UIProvider } from "./context/UIContext";
// import RouteTransitionLoader from "./components/RouteTransitionLoader";
// import { GameProvider } from "./context/GameContext";
// import ReleaseDateAutoSync from "./components/ReleaseDateAutoSync";
// import ReleaseNotificationSync from "./components/ReleaseNotificationSync";
// import {
//   DEFAULT_FONT_PRESET,
//   DEFAULT_THEME_PRESET,
//   FONT_PRESETS,
//   THEME_PRESETS,
// } from "./lib/themes";
// import {
//   DEFAULT_NAVBAR_LAYOUT,
//   NAVBAR_LAYOUT_STORAGE_KEY,
// } from "./lib/uiPreferences";

// const THEME_STORAGE_KEY = "playcrew-theme-preset";
// const FONT_STORAGE_KEY = "playcrew-font-preset";

// const initialUiBootstrapScript = `
// (() => {
//   try {
//     const themeKey = ${JSON.stringify(THEME_STORAGE_KEY)};
//     const fontKey = ${JSON.stringify(FONT_STORAGE_KEY)};
//     const navbarKey = ${JSON.stringify(NAVBAR_LAYOUT_STORAGE_KEY)};
//     const defaultTheme = ${JSON.stringify(DEFAULT_THEME_PRESET)};
//     const defaultFont = ${JSON.stringify(DEFAULT_FONT_PRESET)};
//     const defaultNavbarLayout = ${JSON.stringify(DEFAULT_NAVBAR_LAYOUT)};
//     const themePresets = ${JSON.stringify(THEME_PRESETS.map(({ id }) => id))};
//     const fontPresets = ${JSON.stringify(
//       FONT_PRESETS.map(
//         ({
//           id,
//           fontFamily,
//           buttonScale,
//           buttonLetterSpacing,
//           buttonLineHeight,
//         }) => ({
//           id,
//           fontFamily,
//           buttonScale,
//           buttonLetterSpacing,
//           buttonLineHeight,
//         }),
//       ),
//     )};

//     const storedTheme = window.localStorage.getItem(themeKey);
//     const storedFont = window.localStorage.getItem(fontKey);
//     const storedNavbarLayout = window.localStorage.getItem(navbarKey);

//     const nextTheme = themePresets.includes(storedTheme ?? "")
//       ? storedTheme
//       : defaultTheme;
//     const nextFont = fontPresets.some((preset) => preset.id === storedFont)
//       ? storedFont
//       : defaultFont;
//     const nextNavbarLayout =
//       storedNavbarLayout === "top" || storedNavbarLayout === "sidebar"
//         ? storedNavbarLayout
//         : defaultNavbarLayout;
//     const selectedFont =
//       fontPresets.find((preset) => preset.id === nextFont) ?? fontPresets[0];

//     document.documentElement.dataset.appTheme = nextTheme;
//     document.documentElement.dataset.appFont = nextFont;
//     document.documentElement.dataset.navbarLayout = nextNavbarLayout;
//     document.documentElement.style.setProperty(
//       "--app-font",
//       selectedFont.fontFamily,
//     );
//     document.documentElement.style.setProperty(
//       "--app-button-font-scale",
//       selectedFont.buttonScale,
//     );
//     document.documentElement.style.setProperty(
//       "--app-button-letter-spacing",
//       selectedFont.buttonLetterSpacing,
//     );
//     document.documentElement.style.setProperty(
//       "--app-button-line-height",
//       selectedFont.buttonLineHeight,
//     );
//   } catch {
//     // If storage is unavailable, the CSS defaults still render the app safely.
//   }
// })();
// `;

// interface RootLayoutProps {
//   children: ReactNode;
// }

// export default function RootLayout({ children }: RootLayoutProps) {
//   const contentVariants: Variants = {
//     hidden: { opacity: 0 },
//     visible: {
//       opacity: 1,
//       transition: { duration: 0.8, ease: [0.42, 0, 0.58, 1], delay: 0.8 },
//     },
//   };

//   const pathname = usePathname();
//   const hasHydrated = useRef(false);

//   useEffect(() => {
//     // skip first load
//     if (!hasHydrated.current) {
//       hasHydrated.current = true;
//       return;
//     }

//     const blockedRoutes = ["/", "/menu", "/auth", "/dashboard"];

//     if (!blockedRoutes.includes(pathname)) {
//       localStorage.setItem("lastPage", pathname);
//     }
//   }, [pathname]);

//   return (
//     <html lang="en" suppressHydrationWarning>
//       <head>
//         <script
//           dangerouslySetInnerHTML={{ __html: initialUiBootstrapScript }}
//         />
//       </head>
//       <body className="app-body antialiased">
//         <GlobalToaster />

//         <HelmetProvider>
//           <AuthModalProvider>
//             <UserProvider>
//               <ThemeSync />
//               <GameProvider>
//                 <ReleaseDateAutoSync />
//                 <ReleaseNotificationSync />
//                 <MusicProvider>
//                   <UIProvider>
//                     <RouteTransitionLoader />
//                     <div className="app-shell flex min-h-screen overflow-hidden">
//                       <Navbar />

//                       <motion.main
//                         className="flex-1 overflow-y-auto max-w-full"
//                         variants={contentVariants}
//                         initial="hidden"
//                         animate="visible"
//                       >
//                         {children}
//                       </motion.main>
//                     </div>
//                     <AuthModal />
//                     <MusicPlayer />
//                   </UIProvider>
//                 </MusicProvider>
//               </GameProvider>
//             </UserProvider>
//           </AuthModalProvider>
//         </HelmetProvider>
//       </body>
//     </html>
//   );
// }
